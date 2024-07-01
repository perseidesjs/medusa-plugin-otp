import { TransactionBaseService, type EventBusService } from '@medusajs/medusa'
import type { Redis } from 'ioredis'
import { createHmac, randomBytes } from 'node:crypto'
import { OTPGeneratedEventData } from 'src/types/events'
import type { PluginOptions } from '../types/options'

type InjectedDependencies = {
	redisClient: Redis
	eventBusService: EventBusService
}


class TOTPService extends TransactionBaseService {
	static Events = {
		GENERATED: 'totp.generated',
		DELETED: 'totp.deleted',
	}

	private readonly redisClient_: Redis
	private readonly eventBus_: EventBusService

	private readonly defaultOptions: Required<PluginOptions> = {
		ttl: 60, // 1 minute
		digits: 6, // 6 digits
	}

	constructor(container: InjectedDependencies, options: PluginOptions) {
		super(container)

		this.redisClient_ = container.redisClient
		this.eventBus_ = container.eventBusService

		this.defaultOptions = {
			...this.defaultOptions,
			...options
		}
	}

	generateSecret(): string {
		return randomBytes(32).toString('hex')
	}

	private generateTOTP(secret: string, timeStep: number): string {
		const time = Math.floor(Date.now() / 1000 / timeStep)

		const hmac = createHmac('sha1', Buffer.from(secret, 'hex'))
		hmac.update(Buffer.from(time.toString(), 'utf-8'))
		const hmacResult = hmac.digest()

		const offset = hmacResult[hmacResult.length - 1] & 0xf
		const binary =
			((hmacResult[offset] & 0x7f) << 24) |
			((hmacResult[offset + 1] & 0xff) << 16) |
			((hmacResult[offset + 2] & 0xff) << 8) |
			(hmacResult[offset + 3] & 0xff)

		return (binary % Math.pow(10, this.defaultOptions.digits)).toString().padStart(this.defaultOptions.digits, '0')
	}

	async generate(key: string, secret?: string): Promise<string> {
		const otp = this.generateTOTP(secret || this.generateSecret(), this.defaultOptions.ttl)
		await this.redisClient_.set(`totp:${key}`, otp, 'EX', this.defaultOptions.ttl)
		await this.eventBus_.emit(TOTPService.Events.GENERATED, { key, otp } as OTPGeneratedEventData)
		return otp
	}

	async verify(key: string, providedOtp: string): Promise<boolean> {
		const storedOtp = await this.redisClient_.get(`totp:${key}`)

		const isValid = storedOtp === providedOtp

		if (isValid) {
			await this.redisClient_.del(`totp:${key}`)
			await this.eventBus_.emit(TOTPService.Events.DELETED, { key })
		}

		return isValid
	}
}

export default TOTPService
