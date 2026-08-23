package com.yonatan.tapconnect

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.util.Log
import java.io.IOException
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/** What one tap ended up doing. */
sealed interface ConnectOutcome {
    /** Nothing to do — the device was already connected. */
    data class AlreadyConnected(val name: String) : ConnectOutcome

    /** Verified connected: a profile reported STATE_CONNECTED before we gave up waiting. */
    data class Connected(val name: String) : ConnectOutcome

    /**
     * The direct connect calls were unavailable (they are privileged on modern Android),
     * so we brought up the radio link instead and the earbuds have to finish the job.
     * Usually they do, a second or two after we stop watching.
     */
    data class Nudged(val name: String) : ConnectOutcome

    /** Every attempt errored out. */
    data class Failed(val name: String) : ConnectOutcome

    object BluetoothOff : ConnectOutcome

    /** No device saved and nothing bonded that looks like [Prefs.DEFAULT_NAME_HINT]. */
    object NoDeviceChosen : ConnectOutcome

    object Unsupported : ConnectOutcome
}

/**
 * Connects a bonded Bluetooth audio device without going through Settings.
 *
 * There is no public API for "connect this headset" — `BluetoothA2dp.connect()` and friends are
 * hidden and, since Android 11, guarded by BLUETOOTH_PRIVILEGED (system apps only). So this walks
 * a ladder of increasingly indirect approaches and stops at the first one that sticks:
 *
 *  1. reflective `connect()` on the A2DP and HFP profile proxies,
 *  2. reflective `BluetoothDevice.connect()` / `BluetoothAdapter.connectAllEnabledProfiles()`,
 *  3. an SDP query plus an RFCOMM socket attempt, which forces an ACL link — most headsets
 *     (the EAZ100 included) then initiate A2DP/HFP themselves.
 *
 * Everything here blocks, so call it off the main thread.
 */
object BtConnector {

    private const val TAG = "TapConnect"

    /** Handsfree service UUID — the socket attempt is expected to fail; the ACL link is the point. */
    private val HANDSFREE_UUID: UUID = UUID.fromString("0000111e-0000-1000-8000-00805f9b34fb")

    private const val PROXY_TIMEOUT_MS = 4_000L
    private const val CONNECT_WAIT_MS = 6_000L
    private const val NUDGE_WAIT_MS = 8_000L

    @SuppressLint("MissingPermission") // callers check BLUETOOTH_CONNECT first
    fun connect(context: Context): ConnectOutcome {
        val adapter = adapter(context) ?: return ConnectOutcome.Unsupported
        if (!adapter.isEnabled) return ConnectOutcome.BluetoothOff

        val device = resolveDevice(context, adapter) ?: return ConnectOutcome.NoDeviceChosen
        val name = device.name ?: Prefs.savedName(context) ?: device.address

        var a2dp: BluetoothProfile? = null
        var headset: BluetoothProfile? = null
        try {
            a2dp = openProxy(context, adapter, BluetoothProfile.A2DP)
            headset = openProxy(context, adapter, BluetoothProfile.HEADSET)

            if (isConnected(a2dp, device) || isConnected(headset, device)) {
                return ConnectOutcome.AlreadyConnected(name)
            }

            var attempted = profileConnect(a2dp, device)
            attempted = profileConnect(headset, device) || attempted
            attempted = deviceConnect(device) || attempted
            attempted = adapterConnectAll(adapter, device) || attempted

            if (attempted && waitForConnection(a2dp, headset, device, CONNECT_WAIT_MS)) {
                return ConnectOutcome.Connected(name)
            }

            val nudged = nudge(device)
            if (waitForConnection(a2dp, headset, device, NUDGE_WAIT_MS)) {
                return ConnectOutcome.Connected(name)
            }

            return if (nudged || attempted) ConnectOutcome.Nudged(name) else ConnectOutcome.Failed(name)
        } finally {
            a2dp?.let { adapter.closeProfileProxy(BluetoothProfile.A2DP, it) }
            headset?.let { adapter.closeProfileProxy(BluetoothProfile.HEADSET, it) }
        }
    }

    fun adapter(context: Context): BluetoothAdapter? =
        (context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager?)?.adapter

    /** The saved device, or the first bonded device whose name matches the EAZ100 hint. */
    @SuppressLint("MissingPermission")
    fun resolveDevice(context: Context, adapter: BluetoothAdapter): BluetoothDevice? {
        val bonded = try {
            adapter.bondedDevices ?: emptySet()
        } catch (t: Throwable) {
            Log.w(TAG, "cannot read bonded devices", t)
            emptySet()
        }

        Prefs.savedAddress(context)?.let { saved ->
            bonded.firstOrNull { it.address.equals(saved, ignoreCase = true) }?.let { return it }
        }

        val hint = Prefs.DEFAULT_NAME_HINT
        return bonded.firstOrNull { device ->
            device.name?.replace(" ", "")?.contains(hint, ignoreCase = true) == true
        }
    }

    @SuppressLint("MissingPermission")
    private fun isConnected(proxy: BluetoothProfile?, device: BluetoothDevice): Boolean = try {
        proxy?.getConnectionState(device) == BluetoothProfile.STATE_CONNECTED
    } catch (t: Throwable) {
        false
    }

    private fun waitForConnection(
        a2dp: BluetoothProfile?,
        headset: BluetoothProfile?,
        device: BluetoothDevice,
        timeoutMs: Long,
    ): Boolean {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            if (isConnected(a2dp, device) || isConnected(headset, device)) return true
            try {
                Thread.sleep(250)
            } catch (e: InterruptedException) {
                Thread.currentThread().interrupt()
                return false
            }
        }
        return false
    }

    private fun openProxy(
        context: Context,
        adapter: BluetoothAdapter,
        profile: Int,
    ): BluetoothProfile? {
        val latch = CountDownLatch(1)
        val result = AtomicReference<BluetoothProfile?>()
        val listener = object : BluetoothProfile.ServiceListener {
            override fun onServiceConnected(which: Int, proxy: BluetoothProfile) {
                result.set(proxy)
                latch.countDown()
            }

            override fun onServiceDisconnected(which: Int) {
                latch.countDown()
            }
        }

        val requested = try {
            adapter.getProfileProxy(context.applicationContext, listener, profile)
        } catch (t: Throwable) {
            Log.w(TAG, "getProfileProxy($profile) threw", t)
            false
        }
        if (!requested) return null

        latch.await(PROXY_TIMEOUT_MS, TimeUnit.MILLISECONDS)
        return result.get()
    }

    /** Hidden `BluetoothA2dp/BluetoothHeadset.connect(device)`. Privileged on Android 11+. */
    private fun profileConnect(proxy: BluetoothProfile?, device: BluetoothDevice): Boolean {
        proxy ?: return false
        return try {
            val method = proxy.javaClass.getMethod("connect", BluetoothDevice::class.java)
            method.isAccessible = true
            val accepted = method.invoke(proxy, device)
            Log.d(TAG, "${proxy.javaClass.simpleName}.connect -> $accepted")
            accepted != false
        } catch (t: Throwable) {
            Log.d(TAG, "${proxy.javaClass.simpleName}.connect unavailable: ${t.cause ?: t}")
            false
        }
    }

    /** Hidden `BluetoothDevice.connect()` (API 30+). */
    private fun deviceConnect(device: BluetoothDevice): Boolean = try {
        val method = device.javaClass.getMethod("connect")
        method.isAccessible = true
        val status = method.invoke(device)
        Log.d(TAG, "BluetoothDevice.connect -> $status")
        true
    } catch (t: Throwable) {
        Log.d(TAG, "BluetoothDevice.connect unavailable: ${t.cause ?: t}")
        false
    }

    /** Hidden `BluetoothAdapter.connectAllEnabledProfiles(device)`. */
    private fun adapterConnectAll(adapter: BluetoothAdapter, device: BluetoothDevice): Boolean = try {
        val method = adapter.javaClass.getMethod("connectAllEnabledProfiles", BluetoothDevice::class.java)
        method.isAccessible = true
        val status = method.invoke(adapter, device)
        Log.d(TAG, "connectAllEnabledProfiles -> $status")
        true
    } catch (t: Throwable) {
        Log.d(TAG, "connectAllEnabledProfiles unavailable: ${t.cause ?: t}")
        false
    }

    /**
     * Bring up the ACL link so the earbuds notice us. The SDP query and the socket attempt both
     * force a baseband connection; the socket itself is expected to be refused (the Bluetooth
     * stack owns the Handsfree channel), which is fine — headsets that see an incoming link
     * generally initiate A2DP/HFP on their own.
     */
    @SuppressLint("MissingPermission")
    private fun nudge(device: BluetoothDevice): Boolean {
        var touched = false

        try {
            device.fetchUuidsWithSdp()
            touched = true
        } catch (t: Throwable) {
            Log.d(TAG, "fetchUuidsWithSdp failed: $t")
        }

        var socket: BluetoothSocket? = null
        try {
            socket = device.createInsecureRfcommSocketToServiceRecord(HANDSFREE_UUID)
            socket.connect()
            touched = true
        } catch (e: IOException) {
            // Expected: the Bluetooth stack owns the Handsfree channel. We still attempted a
            // baseband connection, which is the useful part.
            Log.d(TAG, "rfcomm nudge refused: $e")
            touched = true
        } catch (t: Throwable) {
            Log.d(TAG, "rfcomm nudge unavailable: $t")
        } finally {
            try {
                socket?.close()
            } catch (ignored: Throwable) {
            }
        }

        return touched
    }
}
