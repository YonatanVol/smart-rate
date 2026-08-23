package com.yonatan.tapconnect

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.bluetooth.BluetoothClass
import android.bluetooth.BluetoothDevice
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.widget.ArrayAdapter
import android.widget.ListView
import android.widget.TextView
import android.widget.Toast

/**
 * One-time setup: pick which bonded device the shortcut connects to. Reachable by long-pressing
 * the app icon, and shown automatically when nothing is saved and no bonded device looks like the
 * EAZ100.
 */
class DevicePickerActivity : Activity() {

    private val devices = mutableListOf<BluetoothDevice>()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_picker)

        if (missingConnectPermission()) {
            requestPermissions(arrayOf(Manifest.permission.BLUETOOTH_CONNECT), REQ_PERMISSION)
            return
        }
        populate()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQ_PERMISSION) return
        if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
            populate()
        } else {
            Toast.makeText(this, R.string.need_permission, Toast.LENGTH_LONG).show()
            finish()
        }
    }

    @SuppressLint("MissingPermission") // checked above
    private fun populate() {
        val adapter = BtConnector.adapter(this)
        val list = findViewById<ListView>(R.id.device_list)
        val empty = findViewById<TextView>(R.id.empty)

        devices.clear()
        val bonded = try {
            adapter?.bondedDevices ?: emptySet()
        } catch (t: Throwable) {
            emptySet()
        }
        // Headsets and speakers first — they are what anyone is here for.
        devices += bonded.sortedByDescending { it.isAudio() }

        if (devices.isEmpty()) {
            empty.visibility = View.VISIBLE
            list.visibility = View.GONE
            empty.setOnClickListener {
                startActivity(
                    Intent(Settings.ACTION_BLUETOOTH_SETTINGS)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                )
            }
            return
        }

        empty.visibility = View.GONE
        list.visibility = View.VISIBLE

        val saved = Prefs.savedAddress(this)
        val labels = devices.map { device ->
            val name = device.name ?: getString(R.string.unnamed_device)
            val mark = if (device.address.equals(saved, ignoreCase = true)) " ✓" else ""
            "$name$mark\n${device.address}"
        }
        list.adapter = ArrayAdapter(this, android.R.layout.simple_list_item_1, labels)
        list.setOnItemClickListener { _, _, position, _ ->
            val device = devices[position]
            Prefs.save(this, device.address, device.name)
            Toast.makeText(
                this,
                getString(R.string.device_saved, device.name ?: device.address),
                Toast.LENGTH_SHORT,
            ).show()
            setResult(RESULT_OK)
            finish()
        }
    }

    @SuppressLint("MissingPermission")
    private fun BluetoothDevice.isAudio(): Boolean = try {
        bluetoothClass?.majorDeviceClass == BluetoothClass.Device.Major.AUDIO_VIDEO
    } catch (t: Throwable) {
        false
    }

    private fun missingConnectPermission(): Boolean =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) !=
            PackageManager.PERMISSION_GRANTED

    private companion object {
        const val REQ_PERMISSION = 1
    }
}
