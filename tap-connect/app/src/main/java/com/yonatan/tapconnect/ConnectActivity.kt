package com.yonatan.tapconnect

import android.Manifest
import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.widget.Toast
import java.util.concurrent.Executors

/**
 * The whole app, as far as the home screen is concerned: tap the icon, this runs, nothing is drawn.
 *
 * It stays alive (invisibly) until the connect attempt finishes, so the process is not a cached
 * candidate for death halfway through the handshake.
 */
class ConnectActivity : Activity() {

    private val io = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())
    private var working = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        start()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (!working) start()
    }

    override fun onDestroy() {
        io.shutdown()
        super.onDestroy()
    }

    private fun start() {
        if (missingConnectPermission()) {
            requestPermissions(arrayOf(Manifest.permission.BLUETOOTH_CONNECT), REQ_PERMISSION)
            return
        }

        val adapter = BtConnector.adapter(this)
        if (adapter == null) {
            finishWith(getString(R.string.no_bluetooth))
            return
        }
        if (!adapter.isEnabled) {
            startActivityForResult(Intent(BluetoothAdapter.ACTION_REQUEST_ENABLE), REQ_ENABLE)
            return
        }

        working = true
        toast(getString(R.string.connecting, targetLabel()))
        io.execute {
            val outcome = BtConnector.connect(applicationContext)
            main.post {
                working = false
                report(outcome)
            }
        }
    }

    private fun report(outcome: ConnectOutcome) {
        when (outcome) {
            is ConnectOutcome.Connected -> finishWith(getString(R.string.connected, outcome.name))
            is ConnectOutcome.AlreadyConnected ->
                finishWith(getString(R.string.already_connected, outcome.name))

            is ConnectOutcome.Nudged -> finishWith(getString(R.string.nudged, outcome.name))
            is ConnectOutcome.Failed -> {
                toast(getString(R.string.failed, outcome.name))
                openBluetoothSettings()
                finish()
            }

            ConnectOutcome.BluetoothOff -> finishWith(getString(R.string.bluetooth_off))
            ConnectOutcome.Unsupported -> finishWith(getString(R.string.no_bluetooth))
            ConnectOutcome.NoDeviceChosen -> {
                // Nothing saved and nothing bonded that looks like the earbuds: let them pick.
                startActivityForResult(Intent(this, DevicePickerActivity::class.java), REQ_PICK)
            }
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        when (requestCode) {
            REQ_ENABLE ->
                if (resultCode == RESULT_OK) {
                    // The adapter needs a moment after the system dialog returns.
                    main.postDelayed({ start() }, 1_200)
                } else {
                    finishWith(getString(R.string.bluetooth_off))
                }

            REQ_PICK ->
                if (resultCode == RESULT_OK) start() else finish()
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray,
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode != REQ_PERMISSION) return
        if (grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED) {
            start()
        } else {
            finishWith(getString(R.string.need_permission))
        }
    }

    private fun missingConnectPermission(): Boolean =
        Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) !=
            PackageManager.PERMISSION_GRANTED

    private fun targetLabel(): String =
        Prefs.savedName(this) ?: getString(R.string.default_device_label)

    private fun openBluetoothSettings() {
        try {
            startActivity(
                Intent(Settings.ACTION_BLUETOOTH_SETTINGS)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
        } catch (ignored: Exception) {
        }
    }

    private fun toast(message: String) {
        Toast.makeText(applicationContext, message, Toast.LENGTH_SHORT).show()
    }

    private fun finishWith(message: String) {
        toast(message)
        finish()
    }

    private companion object {
        const val REQ_PERMISSION = 1
        const val REQ_ENABLE = 2
        const val REQ_PICK = 3
    }
}
