import 'reflect-metadata'

import { Body, Controller, Post } from '@nestjs/common'
import { Type } from 'class-transformer'
import { IsInt, IsString } from 'class-validator'

// A route with a body, for the specs of the global `ValidationPipe`: it answers with the body as the pipe left it.

/** The body of `POST /api/echo`: a string and a number. */
export class EchoDto {
  @IsString()
  name!: string

  @Type(() => Number)
  @IsInt()
  count!: number
}

/** Sends the validated body back. */
@Controller('echo')
export class EchoController {
  @Post()
  echo(@Body() body: EchoDto): EchoDto {
    return body
  }
}
