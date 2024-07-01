import { TransactionBaseService, type EventBusService } from '@medusajs/medusa'
import { createHmac, randomBytes } from 'crypto'
import type { Redis } from 'ioredis'
import type { PluginOptions } from 'src/types/options'

type InjectedDependencies = {
	redisClient: Redis
	eventBusService: EventBusService
}

class OTPService extends TransactionBaseService {
	static Events = {
		CREATED: 'otp.generated',
		DELETED: 'otp.deleted',
	}

	private readonly redisClient_: Redis
	private readonly eventBus_: EventBusService

	// Time to live in seconds
	private readonly ttl_: number

	constructor(container: InjectedDependencies, options: PluginOptions) {
		super(container)
		this.redisClient_ = container.redisClient
		this.eventBus_ = container.eventBusService

		const DEFAULT_TTL = 60 // 1 minute
		this.ttl_ = options.ttl ?? DEFAULT_TTL
	}

	generateSecret(): string {
		return randomBytes(32).toString('hex')
	}

	generateTOTP(secret: string, timeStep: number = 30): string {
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

		return (binary % 1000000).toString().padStart(6, '0')
	}

	async storeOTP(otp: string, key: string): Promise<'OK'> {
		return await this.atomicPhase_(async (m) => {
			const res = await this.redisClient_.set(`otp:${key}`, otp, 'EX', 60) // 1 minute
			this.eventBus_
				.withTransaction(m)
				.emit(OTPService.Events.CREATED, { otp, key })
			return res
		})
	}

	async getStoredOTP(key: string): Promise<string | null> {
		return await this.redisClient_.get(`otp:${key}`)
	}

	async deleteOTP(key: string): Promise<number> {
		return await this.atomicPhase_(async (m) => {
			const res = await this.redisClient_.del(`otp:${key}`)
			this.eventBus_.withTransaction(m).emit(OTPService.Events.DELETED, { key })
			return res
		})
	}
}

export default OTPService
