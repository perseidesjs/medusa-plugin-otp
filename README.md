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

<h3>1. Extending the Customer model</h3>

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

Don't to create the migration for this model :

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

<h3>2. Generating a secret</h3>

<p>
When a Customer is created, we need to generate a random secret and save it in the <code>otp_secret</code> field.
</p>
<p>For this, we're going to register a <code>Subscriber</code> for the <code>CustomerService.Events.CREATED</code> event.</p>

```ts
// src/subscribers/customer-created.ts

import { Logger, SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import type { TOTPService } from '@perseidesjs/medusa-plugin-otp'
import { EntityManager } from 'typeorm'

import CustomerService from '../services/customer'

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
import { EntityManager } from 'typeorm'
import CustomerService from '../../../services/customer'

export async function POST(req: MedusaRequest, res: MedusaResponse) {
	const validated = await validator(StorePostAuthReq, req.body)

	const authService: AuthService = req.scope.resolve('authService')
	const manager: EntityManager = req.scope.resolve('manager')

	const result = await manager.transaction(async (transactionManager) => {
		return await authService
			.withTransaction(transactionManager)
			.authenticateCustomer(validated.email, validated.password)
	})

	if (!result.success) {
		res.sendStatus(401)
		return
	}

	const customerService: CustomerService = req.scope.resolve('customerService')
	const totpService: TOTPService = req.scope.resolve('totpService')

	const customer = await customerService.retrieve(result.customer?.id || '', {
		relations: defaultRelations,
		select: [...defaultStoreCustomersFields, 'otp_secret'],
	})

	const otp = await totpService.generate(customer.id, customer.otp_secret)

	const { otp_secret, ...rest } = customer // We omit the otp_secret from the response, you can also handle this in the CustomerService

	res.json({ customer: rest })
}
```

<p> Now whenever a customer logs in, it will no more register a connect_sid cookie, instead, it will generate a new OTP.</p>
<p> You can subscribe to the event <code>TOTPService.Events.GENERATED</code> to be notified when a new OTP is generated, the key used here for example is the customer ID :</p>

```ts
// src/subscribers/otp-generated.ts
import type { Logger, SubscriberArgs, SubscriberConfig } from "@medusajs/medusa";
import { TOTPService } from "@perseidesjs/medusa-plugin-otp";

import type CustomerService from "../services/customer";

/**
 * Send the OTP to the customer whenever the TOTP is generated.
 */
export default async function sendTOTPToCustomerHandler({
    data,
    container
}: SubscriberArgs<{ key: string }>) { // The key here is the customer ID
    const logger = container.resolve<Logger>("logger")

    const customerService = container.resolve<CustomerService>("customerService")

    const customer = await customerService.retrieve(data.key).catch((e) => {
        // In case you are using multiple OTP, if it fails it means the key is invalid / not a customer ID
        logger.failure(activityId, `An error occured while retrieving the customer with ID : ${data.key}!`)
        throw e
    })

    const activityId = logger.activity(`Sending OTP to customer with ID : ${customer.id}`)

    // Use your NotificationService here to send the OTP to the customer (e.g. SendGrid)

    logger.success(activityId, `Successfully sent OTP to customer with ID : ${customer.id}!`)
}

export const config: SubscriberConfig = {
    event: TOTPService.Events.GENERATED,
    context: {
        subscriberId: 'send-totp-to-customer-handler'
    }
}
```

<p>Your customer will now receive an OTP in their email, let's see how to verify it once it's consumed by your customer.</p> 

<h3>4. Verifying the OTP</h3>
<p>
We're now going to create a new route to verify the OTP, this route will be called by the customer when they want to log in, we're going to use the <code>TOTPService</code> to verify the OTP and authenticate the customer.
</p>

```ts
// src/api/store/auth/otp/route.ts

import { validator, type MedusaRequest, type MedusaResponse } from "@medusajs/medusa";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

import type { TOTPService } from "@perseidesjs/medusa-plugin-otp";
import type CustomerService from "../../../../services/customer";

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
<p>Your customer is now authenticated, and the connect_sid cookie is set on the response.</p>


<h2> More information </h2>
<p> You can find the <code>TOTPService</code> class in the <a href="https://github.com/perseidesjs/medusa-plugin-otp/blob/main/src/services/totp.ts">src/services/totp.ts</a> file.</p>

<h2>License</h2>
<p> This project is licensed under the MIT License - see the <a href="./LICENSE.md">LICENSE</a> file for details</p>
