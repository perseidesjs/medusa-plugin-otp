<p align="center">
  <a href="https://www.github.com/perseidesjs">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./.github/dark_mode.png" width="128" height="128">
    <source media="(prefers-color-scheme: light)" srcset="./.github/light_mode.png" width="128" height="128">
    <img alt="Perseides logo" src="./.github/light_mode.png">
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
 A Medusa's plugin for implementing OTP on Medusa v1.x.x
</p>

<p align="center">
  <img src="./.github/preview.gif" alt="Plugin Preview">
</p>

> [!WARNING]
> This package is only for Medusa 1.x, if you need an OTP provider for Medusa 2.x, please refer to the [@perseidesjs/auth-otp](https://github.com/perseidesjs/auth-otp) package.


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
		resolve: `@perseidesjs/medusa-plugin-otp`,
		/** @type {import('@perseidesjs/medusa-plugin-otp').PluginOptions} */
		options: {
			ttl: 30, // In seconds, the time to live of the OTP before expiration
			digits: 6, // The number of digits of the OTP (e.g. 123456)
			timeStep: 30, // The time step in seconds for TOTP generation, this is used to generate a new OTP at a different time each time
		},
	},
]
```

--- 

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
		<tr>
			<td>timeStep</td>
			<td><code>Number</code></td>
			<td><code>30</code></td>
			<td>The time step in seconds for TOTP generation</td>
		</tr>
  </tbody>
</table>

<h2>How to use</h2>

<p>
In this example, we're going to override the current authentication system for the store (`/store/auth`). The workflow we're going to implement is as follows:
</p>

<ol>
  <li>Extend the Customer model to add a new field called <code>otp_secret</code></li>
  <li>When a Customer is created, generate a random secret and save it in the <code>otp_secret</code> field</li>
  <li>When a Customer logs in, generate a new OTP</li>
  <li>Send an e-mail to the customer using a <code>Subscriber</code> and the event used by the <code>TOTPService</code> included in the plugin.</li> 
  <li>Create a new route to verify and authenticate the Customer</li>
</ol>

<h3>1. Extending the Customer model, service and type</h3>

<h4>1.1. Extending the Customer model</h4>

<p>
First, we need to extend the Customer model to add a new field called <code>otp_secret</code>.
</p>

```ts
import { Customer as MedusaCustomer } from '@medusajs/medusa'
import { Column, Entity } from 'typeorm'

@Entity()
export class Customer extends MedusaCustomer {
	@Column({ type: 'text' })
	otp_secret: string
}
```

> If you don't want to expose the field to the API response, you can also add the `select` option in the `Column` decorator.
> ```ts
> @Column({ type: 'text', select: false })
> otp_secret: string
> ```

<h4>1.2. Extending the Customer service</h4>

<p>
We then need to extend the Customer service to make sure the <code>update</code> function will not throw a TypeScript error with the new <code>otp_secret</code> field.
</p>

```ts
// src/services/customer.ts

import {
	Customer,
	CustomerService as MedusaCustomerService,
} from '@medusajs/medusa'
// We alias the UpdateCustomerInput type to avoid name conflicts
import { UpdateCustomerInput as MedusaUpdateCustomerInput } from '@medusajs/medusa/dist/types/customers'
import { Lifetime } from 'awilix'

// 1. Extend the UpdateCustomerInput type to include the otp_secret field
type UpdateCustomerInput = MedusaUpdateCustomerInput & {
	otp_secret?: string
}

class CustomerService extends MedusaCustomerService {
	static LIFE_TIME = Lifetime.SCOPED

	constructor() {
		// @ts-ignore
		super(...arguments)
	}

  // 2. Override the update method to use the new `UpdateCustomerInput` type that includes the `otp_secret` field
	async update(
		customerId: string,
		update: UpdateCustomerInput,
	): Promise<Customer> {
		return await super.update(customerId, update)
	}
}

export default CustomerService
```

> Don't hesitate to extend other functions you need in the same way by just returning the super function with the extended parameters.

<h4>1.3. Creating the migration</h4>
<p>
 Don't forget to create the migration for this model to add the <code>otp_secret</code> field to the <code>customers</code> table.
</p>


```ts
import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddOtpSecretToCustomer1719843922955 implements MigrationInterface {
	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "customer" ADD "otp_secret" text`)
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "customer" DROP COLUMN "otp_secret"`)
	}
}
```

<h4>1.4. Module augmentation</h4>
<p>
Finally, we need to tell TypeScript that the <code>Customer</code> model has a new field called <code>otp_secret</code>.
</p>

```ts
// src/index.d.ts

declare module '@medusajs/medusa/dist/models/customer' {
	interface Customer {
		otp_secret?: string
	}
}
```

> This will allows you to get the `otp_secret` field everywhere the `Customer` type is used.


<h3>2. Generating a secret</h3>

<p>
When a new Customer is created, we need to generate a random secret and save it in the <code>otp_secret</code> field.
</p>
<p>For this, we're going to register a <code>Subscriber</code> for the <code>CustomerService.Events.CREATED</code> event.</p>

```ts
// src/subscribers/customer-created.ts

import type { Logger, SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import type { TOTPService } from '@perseidesjs/medusa-plugin-otp'

import type { CustomerService } from '../services/customer'

type CustomerCreatedEventData = {
	id: string // Customer ID
}

/**
 * This subscriber will be triggered when a new customer is created.
 * It will add an OTP secret to the customer for the sake of OTP authentication.
 */
export default async function setOtpSecretForCustomerHandler({
	data,
	container,
}: SubscriberArgs<CustomerCreatedEventData>) {
	const logger = container.resolve<Logger>('logger')
	const activityId = logger.activity(
		`Adding OTP secret to customer with ID : ${data.id}`,
	)

	const customerService = container.resolve<CustomerService>('customerService')
	const totpService = container.resolve<TOTPService>('totpService')

	const otpSecret = totpService.generateSecret()
	await customerService.update(data.id, {
		otp_secret: otpSecret,
	})

	logger.success(
		activityId,
		`Successfully added OTP secret to customer with ID : ${data.id}!`,
	)
}

export const config: SubscriberConfig = {
	event: CustomerService.Events.CREATED,
	context: {
		subscriberId: 'set-otp-for-customer-handler',
	},
}
```

<h3>3. Override the /store/auth route</h3>
<p>
Now every customer who creates an account will have a unique key enabling him to generate unique OTPs for his account, we're now going to override the current auth route used by Medusa to generate an OTP for the customer instead of the default one.
</p>

```ts
// src/api/store/auth/route.ts

import {
	StorePostAuthReq,
	defaultStoreCustomersFields,
	validator,
	type AuthService,
	type MedusaRequest,
	type MedusaResponse,
} from '@medusajs/medusa'
import { defaultRelations } from '@medusajs/medusa/dist/api/routes/store/auth'
import type { TOTPService } from '@perseidesjs/medusa-plugin-otp'
import type { EntityManager } from 'typeorm'

import type { CustomerService } from '../../../services/customer'

export async function POST(req: MedusaRequest, res: MedusaResponse) {
	const validated = await validator(StorePostAuthReq, req.body)

	const authService: AuthService = req.scope.resolve('authService')
	const manager: EntityManager = req.scope.resolve('manager')

	const result = await manager.transaction(async (transactionManager) => {
		return await authService
			.withTransaction(transactionManager)
			.authenticateCustomerOTP(validated.email)
	})

	if (!result.success) {
		// ℹ️ We don't want to leak information about the email being invalid
		res.status(200).json({
			message: 'If the email is valid, you will receive an OTP to your email.',
		})
		return
	}

	const customerService: CustomerService = req.scope.resolve('customerService')
	const totpService: TOTPService = req.scope.resolve('totpService')

	const customer = await customerService.retrieve(result.customer?.id || '', {
		relations: defaultRelations,
		select: [...defaultStoreCustomersFields, 'otp_secret'],
	})

	await totpService.generate(customer.id, customer.otp_secret)

	res.status(200).json({
		message: 'If the email is valid, you will receive an OTP to your email.',
	})
}
```
<p> Now whenever a customer logs in, it will no more register a session cookie, instead, it will generate a new OTP.</p>
<p> Before we move on, the current route needs an email and a password, we're going to change that, to make sure we only need an email.</p>

<h4>3.1. Override the `StorePostAuthReq` validator to remove the password field</h4>

<p> We'll start by creating a new file in the `src/api` directory to override the `StorePostAuthReq` validator.</p>

```ts
// src/api/index.ts

import { registerOverriddenValidators, StorePostAuthReq as MedusaStorePostAuthReq } from '@medusajs/medusa'
import { IsString, IsOptional } from 'class-validator'

class StorePostAuthReq extends MedusaStorePostAuthReq {
	@IsString()
	@IsOptional() // ℹ️ Since we can't remove a field on the original validator, we make it optional
	password: string 
}

registerOverriddenValidators(StorePostAuthReq)
```



<h3>4. Subscribing to the event</h3>
<p> You can subscribe to the event <code>TOTPService.Events.GENERATED</code> to be notified when a new OTP is generated, the key used here for example is the customer ID :</p>

```ts
// src/subscribers/otp-generated.ts
import type { Logger, SubscriberArgs, SubscriberConfig } from "@medusajs/medusa";
import type { TOTPService } from "@perseidesjs/medusa-plugin-otp";

import type { CustomerService } from '../services/customer'

type OTPGeneratedEventData = {
    key: string // Customer ID
    otp: string // The OTP generated
}

/**
 * Send the OTP to the customer whenever the TOTP is generated.
 */
export default async function sendTOTPToCustomerHandler({
    data,
    container
}: SubscriberArgs<OTPGeneratedEventData>) { // The key here is the customer ID
    const logger = container.resolve<Logger>("logger")

    const customerService = container.resolve<CustomerService>("customerService")

    const customer = await customerService.retrieve(data.key)

    const activityId = logger.activity(`Sending OTP to customer with ID : ${customer.id}`)

    // Use your NotificationService here to send the `data.otp` to the customer (e.g. SendGrid, SMS...)

    logger.success(activityId, `Successfully sent OTP to customer with ID : ${customer.id}!`)
}

export const config: SubscriberConfig = {
    event: TOTPService.Events.GENERATED,
    context: {
        subscriberId: 'send-totp-to-customer-handler'
    }
}
```

<p>Your customer will now receive an OTP, let's see how to verify it once it's consumed by your customer.</p> 

<h3>5. Verifying the OTP</h3>
<p>
We're now going to create a new route to verify the OTP, this route will be called by the customer when they want to log in, we're going to use the <code>TOTPService</code> to verify the OTP and authenticate the customer.
</p>

```ts
// src/api/store/auth/otp/route.ts

import { validator, type MedusaRequest, type MedusaResponse } from "@medusajs/medusa";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

import type { TOTPService } from "@perseidesjs/medusa-plugin-otp";

import type { CustomerService } from '../../../services/customer'

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  const validated = await validator(StoreVerifyOTP, req.body);

  const customerService = req.scope.resolve<CustomerService>("customerService");
  const totpService = req.scope.resolve<TOTPService>("totpService");

  const customer = await customerService.retrieveRegisteredByEmail(validated.email);

  const isValid = await totpService.verify(customer.id, validated.otp)

  if (!isValid) {
    res.status(400).send({ error: "OTP is invalid" });
    return
  }

  // Set customer id on session, this is stored on the server (connect_sid).
  req.session.customer_id = customer.id;

  res.status(200).json({ customer })
}


class StoreVerifyOTP {
  @IsString()
  otp: string;

  @IsEmail()
  email: string;
}
```
<p>Your customer is now authenticated, and the `connect_sid` cookie is set on the response.</p>


<h2> More information </h2>
<p> You can find the <code>TOTPService</code> class in the <a href="https://github.com/perseidesjs/medusa-plugin-otp/blob/main/src/services/totp.ts">src/services/totp.ts</a> file.</p>

<h2>Need Help?</h2>
<p>If you encounter any issues or have any questions, please do not hesitate to open a new issue on our <a href="https://github.com/perseidesjs/medusa-plugin-otp/issues">GitHub repository</a>. We're here to help!</p>


<h2>License</h2>
<p> This project is licensed under the MIT License - see the <a href="./LICENSE.md">LICENSE</a> file for details</p>
