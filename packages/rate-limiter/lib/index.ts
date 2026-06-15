interface RefillBucket {
	count: number;
	refilledAt: number;
}

export class RefillingTokenBucket<_Key> {
	max: number;
	refillIntervalSeconds: number;

	constructor(max: number, refillIntervalSeconds: number) {
		this.max = max;
		this.refillIntervalSeconds = refillIntervalSeconds;
	}

	private readonly storage = new Map<_Key, RefillBucket>();

	check(key: _Key, cost: number): boolean {
		const bucket = this.storage.get(key);

		if (bucket == null) {
			return true;
		}

		const now = Date.now();
		const refill = Math.floor((now - bucket.refilledAt) / (this.refillIntervalSeconds * 1000));

		if (refill > 0) {
			return Math.min(bucket.count + refill, this.max) >= cost;
		}

		return bucket.count >= cost;
	}

	consume(key: _Key, cost: number): boolean {
		let bucket = this.storage.get(key);

		const now = Date.now();

		if (bucket == null) {
			bucket = {
				count: this.max - cost,
				refilledAt: now,
			};

			this.storage.set(key, bucket);

			return true;
		}

		const refill = Math.floor((now - bucket.refilledAt) / (this.refillIntervalSeconds * 1000));

		bucket.count = Math.min(bucket.count + refill, this.max);
		bucket.refilledAt = now;

		if (bucket.count < cost) {
			return false;
		}

		bucket.count -= cost;

		this.storage.set(key, bucket);

		return true;
	}
}

interface ThrottlingCounter {
	timeout: number;
	updatedAt: number;
}

export class Throttler<_Key> {
	timeoutSeconds: Array<number>;

	private readonly storage = new Map<_Key, ThrottlingCounter>();

	constructor(timeoutSeconds: Array<number>) {
		this.timeoutSeconds = timeoutSeconds;
	}

	consume(key: _Key): boolean {
		let counter = this.storage.get(key);

		const now = Date.now();

		if (counter == null) {
			counter = {
				timeout: 0,
				updatedAt: now,
			};

			this.storage.set(key, counter);

			return true;
		}

		const allowed = now - counter.updatedAt >= this.timeoutSeconds[counter.timeout]! * 1000;
		if (!allowed) {
			return false;
		}

		counter.updatedAt = now;
		counter.timeout = Math.min(counter.timeout + 1, this.timeoutSeconds.length - 1);

		this.storage.set(key, counter);

		return true;
	}

	reset(key: _Key): void {
		this.storage.delete(key);
	}
}

interface ExpiringBucket {
	count: number;
	createdAt: number;
}

export class ExpiringTokenBucket<_Key> {
	max: number;
	expiresInSeconds: number;

	private readonly storage = new Map<_Key, ExpiringBucket>();

	constructor(max: number, expiresInSeconds: number) {
		this.max = max;
		this.expiresInSeconds = expiresInSeconds;
	}

	check(key: _Key, cost: number): boolean {
		const bucket = this.storage.get(key);

		const now = Date.now();

		if (bucket == null) {
			return true;
		}

		if (now - bucket.createdAt >= this.expiresInSeconds * 1000) {
			return true;
		}

		return bucket.count >= cost;
	}

	consume(key: _Key, cost: number): boolean {
		let bucket = this.storage.get(key);

		const now = Date.now();

		if (bucket == null) {
			bucket = {
				count: this.max - cost,
				createdAt: now,
			};

			this.storage.set(key, bucket);

			return true;
		}

		if (now - bucket.createdAt >= this.expiresInSeconds * 1000) {
			bucket.count = this.max;
		}

		if (bucket.count < cost) {
			return false;
		}

		bucket.count -= cost;

		this.storage.set(key, bucket);

		return true;
	}

	reset(key: _Key): void {
		this.storage.delete(key);
	}
}
