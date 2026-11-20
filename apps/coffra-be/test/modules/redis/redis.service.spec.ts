import { type AddressInfo, createServer, type Server, type Socket } from 'node:net'
import { setTimeout as sleep } from 'node:timers/promises'

import type { ConfigService } from '@nestjs/config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { Env } from '../../../src/modules/config'
import { RedisService } from '../../../src/modules/redis'

// The client against a TCP server of the spec that only records connections and hangs up: no Redis, no Docker. What the
// commands do in a real Redis is in `test/integration/rate-limit/`.

describe('RedisService', () => {
  let server: Server
  let sockets: Socket[]
  let service: RedisService

  beforeEach(async () => {
    sockets = []
    server = createServer((socket) => {
      sockets.push(socket)
      socket.destroy()
    })
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', resolve)
    })
    const { port } = server.address() as AddressInfo
    const config = { get: () => `redis://127.0.0.1:${port}/3` } as unknown as ConfigService<Env, true>

    service = new RedisService(config)
  })

  afterEach(async () => {
    await service.onApplicationShutdown()
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve()
      })
    })
    vi.restoreAllMocks()
  })

  it('connects to the REDIS_URL of the configuration', () => {
    const { port } = server.address() as AddressInfo

    expect(service.options).toMatchObject({ host: '127.0.0.1', port, db: 3 })
  })

  it('does not connect when it is created, so a start does not wait for Redis', async () => {
    await sleep(300)

    expect(service.status).toBe('wait')
    expect(sockets).toHaveLength(0)
  })

  it('connects with the first command, and fails that command fast when Redis hangs up', async () => {
    await expect(service.ping()).rejects.toThrow()

    expect(sockets.length).toBeGreaterThan(0)
  })

  it('listens to the errors of the connection, so ioredis does not print every failed attempt', () => {
    expect(service.listenerCount('error')).toBeGreaterThan(0)
  })

  describe('at shutdown', () => {
    it('drops a connection that was never opened, without opening it to say goodbye', async () => {
      const quit = vi.spyOn(service, 'quit')

      await service.onApplicationShutdown()
      await sleep(100)

      expect(quit).not.toHaveBeenCalled()
      expect(sockets).toHaveLength(0)
      expect(service.status).toBe('end')
    })

    it('quits an open connection', async () => {
      Reflect.set(service, 'status', 'ready')
      const quit = vi.spyOn(service, 'quit').mockResolvedValue('OK')
      const disconnect = vi.spyOn(service, 'disconnect')

      await service.onApplicationShutdown()

      expect(quit).toHaveBeenCalledOnce()
      expect(disconnect).not.toHaveBeenCalled()
    })

    it('drops the connection when quitting fails, instead of failing the shutdown', async () => {
      Reflect.set(service, 'status', 'ready')
      vi.spyOn(service, 'quit').mockRejectedValue(new Error('Connection is closed.'))
      const disconnect = vi.spyOn(service, 'disconnect')

      await expect(service.onApplicationShutdown()).resolves.toBeUndefined()

      expect(disconnect).toHaveBeenCalled()
    })
  })
})
