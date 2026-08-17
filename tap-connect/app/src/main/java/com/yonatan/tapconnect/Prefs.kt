package com.yonatan.tapconnect

import android.content.Context

/** Remembers which bonded device the one-tap shortcut should connect to. */
object Prefs {

    /** Substring matched against bonded device names when nothing has been picked yet. */
    const val DEFAULT_NAME_HINT = "eaz100"

    private const val FILE = "tap-connect"
    private const val KEY_ADDRESS = "device_address"
    private const val KEY_NAME = "device_name"

    private fun prefs(context: Context) =
        context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    fun savedAddress(context: Context): String? = prefs(context).getString(KEY_ADDRESS, null)

    fun savedName(context: Context): String? = prefs(context).getString(KEY_NAME, null)

    fun save(context: Context, address: String, name: String?) {
        prefs(context).edit()
            .putString(KEY_ADDRESS, address)
            .putString(KEY_NAME, name)
            .apply()
    }
}
