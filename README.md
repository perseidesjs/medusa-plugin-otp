<p align="center">
  <a href="https://www.github.com/perseidesjs">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./.r/dark.png" width="128" height="128">
    <source media="(prefers-color-scheme: light)" srcset="./.r/light.png" width="128" height="128">
    <img alt="Perseides logo" src="./.r/light.png">
    </picture>
  </a>
</p>
<h1 align="center">
  @perseidesjs/medusa-plugin-otp
</h1>

<p align="center">
  <img src="https://img.shields.io/npm/v/@perseidesjs/medusa-plugin-otp" alt="npm version">
  <img src="https://img.shields.io/github/license/perseidesjs/medusa-plugin-otp" alt="GitHub license">
</p>

<h4 align="center">
  <a href="https://perseides.org">Website</a> |
  <a href="https://www.medusajs.com">Medusa</a>
</h4>

<p align="center">
 A Medusa's plugin for implementing OTP.
</p>

<h2>
  Installation
</h2>

```bash
npm install @perseidesjs/medusa-plugin-otp
```

<h2>
  Usage
</h2>
<p>
This plugin uses Redis under the hood, this plugin will also work in a development environment thanks to the fake Redis instance created by Medusa, remember to use Redis in production, by just passing the <code>redis_url</code> option to the <code>medusa-config.js > projectConfig</code> object.
</p>

<h3>
  Plugin configuration
</h3>

<p>
You need to add the plugin to your Medusa configuration before you can use the OTPService. To do this, import the plugin as follows: 
</p>

```ts
const plugins = [
	`medusa-fulfillment-manual`,
	`medusa-payment-manual`,
	`@perseidesjs/medusa-plugin-otp`,
]
```

<p>You can also override the default configuration by passing an object to the plugin as follows: </p>

```ts
const plugins = [
	`medusa-fulfillment-manual`,
	`medusa-payment-manual`,
	{
		resolve: `@perseidesjs/medusa-otp`,
		/** @type {import('@perseidesjs/medusa-plugin-otp').PluginOptions} */
		options: {
			ttl: 30, // In seconds, the time to live of the OTP before expiration
      digits: 6, // The number of digits of the OTP (e.g. 123456)
		},
	},
]
```

<h3> Default configuration </h3>

<table>
  <thead>
    <tr>
      <th>Option</th>
      <th>Type</th>
      <th>Default</th>
      <th>Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>ttl</td>
      <td><code>Number</code></td>
      <td><code>60</code></td>
      <td>The time to live of the OTP before expiration</td>
    </tr>
    <tr>
      <td>digits</td>
      <td><code>Number</code></td>
      <td><code>6</code></td>
      <td>The number of digits of the OTP (e.g. 123456)</td>
    </tr>
  </tbody>
</table>

<h2> Usage </h2>

<p>Coming soon...</p>


<h2> More information </h2>
<p> You can find the <code>OTPService</code> class in the <a href="https://github.com/perseidesjs/medusa-plugin-otp/blob/main/src/services/otp.ts">src/services/otp.ts</a> file.</p>

<h2>License</h2>
<p> This project is licensed under the MIT License - see the <a href="./LICENSE.md">LICENSE</a> file for details</p>
