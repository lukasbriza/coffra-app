import 'reflect-metadata'

import { Body, Controller, type INestApplication, Post } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { Type } from 'class-transformer'
import { IsInt, IsString } from 'class-validator'
import request from 'supertest'
import type { App } from 'supertest/types'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { configureApp } from '../src/app.setup'
import { HealthModule } from '../src/modules/health'
import { PrismaService } from '../src/modules/prisma/prisma.service'
import { buildSwaggerDocument, setupSwagger } from '../src/swagger.setup'

class EchoDto {
  @IsString()
  name!: string

  @Type(() => Number)
  @IsInt()
  count!: number
}

@Controller('echo')
class EchoController {
  @Post()
  echo(@Body() body: EchoDto): EchoDto {
    return body
  }
}

const queryRaw = vi.fn()

type HealthBody = {
  status: string
  info?: { database: { status: string } }
  error?: { database: { status: string } }
}

describe('app setup', () => {
  let app: INestApplication
  const server = (): App => app.getHttpServer() as App

  beforeEach(async () => {
    queryRaw.mockReset().mockResolvedValue([])

    const moduleRef = await Test.createTestingModule({
      imports: [HealthModule],
      controllers: [EchoController],
    })
      .useMocker((token) => (token === PrismaService ? { $queryRaw: queryRaw } : undefined))
      .compile()

    app = moduleRef.createNestApplication()
    configureApp(app)
    setupSwagger(app)
    await app.init()
  })

  afterEach(async () => {
    await app.close()
  })

  describe('ValidationPipe', () => {
    it('rejects an invalid body with 400', async () => {
      await request(server()).post('/api/echo').send({ name: 'a', count: 'abc' }).expect(400)
    })

    it('strips unknown properties and transforms types', async () => {
      const response = await request(server())
        .post('/api/echo')
        .send({ name: 'a', count: '5', extra: true })
        .expect(201)

      expect(response.body).toEqual({ name: 'a', count: 5 })
    })
  })

  describe('GET /api/health', () => {
    it('returns 200 when the database is up', async () => {
      const response = await request(server()).get('/api/health').expect(200)

      const body = response.body as HealthBody
      expect(body.status).toBe('ok')
      expect(body.info?.database.status).toBe('up')
    })

    it('returns 503 when the database is down', async () => {
      queryRaw.mockRejectedValue(new Error('connection refused'))

      const response = await request(server()).get('/api/health').expect(503)

      const body = response.body as HealthBody
      expect(body.status).toBe('error')
      expect(body.error?.database.status).toBe('down')
      expect(JSON.stringify(body)).not.toContain('connection refused')
    })

    it('is not served without the api prefix', async () => {
      await request(server()).get('/health').expect(404)
    })
  })

  describe('Swagger', () => {
    it('declares the bearer security scheme', () => {
      const document = buildSwaggerDocument(app)

      expect(document.components?.securitySchemes).toMatchObject({ bearer: { type: 'http', scheme: 'bearer' } })
    })

    it('serves the UI on /api/swagger', async () => {
      await request(server()).get('/api/swagger').expect(200)
    })
  })
})
