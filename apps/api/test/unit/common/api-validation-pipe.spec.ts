import { BadRequestException } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { UpdateListingDto } from '../../../src/modules/listings/dto/listing.dto.js';
import { ApiValidationPipe } from '../../../src/common/pipes/api-validation.pipe.js';

const meta = (metatype: unknown): ArgumentMetadata => ({ type: 'body', metatype: metatype as never, data: '' });

describe('ApiValidationPipe', () => {
  it('treats an explicit null as not provided on a PATCH body, so it never reaches a non-nullable column', async () => {
    const value = await new ApiValidationPipe().transform({ price: null, titleAr: 'شقة' }, meta(UpdateListingDto));
    expect(value).toMatchObject({ titleAr: 'شقة' });
    expect('price' in (value as object)).toBe(false);
  });

  it('still rejects a body that is invalid for its own sake', async () => {
    await expect(new ApiValidationPipe().transform({ price: -5 }, meta(UpdateListingDto))).rejects.toThrow(BadRequestException);
  });

  it('keeps intentional clears such as an empty-string phone', async () => {
    const value = await new ApiValidationPipe().transform({ phone: '' }, meta(UpdateListingDto));
    expect(value).toMatchObject({ phone: '' });
  });
});
