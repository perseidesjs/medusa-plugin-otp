/**
 * ### Description
 * Options for the OTP service (optional).
 * #### Default to `{ ttl: 60, digits: 6 }`
 *
 * ### Example
 * In the following, it means that an OTP will be valid for 1 minute, ttl is expressed in seconds.
 *
 * ```js
 * {
 *   resolve: `@perseidesjs/medusa-plugin-otp`,
 *   options: {
 * 		ttl: 30 // 30 seconds
 * 		digits: 6 // 6 digits
 * 		timeStep: 30 // 30 seconds time step for TOTP generation
 *   },
 * }
 * ```
 */
export type PluginOptions = {
	/**
	 * TTL in seconds for the OTP
	 * @default 60
	 */
	ttl?: number
	/**
	 * Number of digits for the OTP
	 * @default 6
	 */
	digits?: number
	/**
	 * Time step in seconds for TOTP generation
	 * @default 30
	 */
	timeStep?: number
}
