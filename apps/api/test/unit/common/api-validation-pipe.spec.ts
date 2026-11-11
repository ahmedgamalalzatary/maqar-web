import { BadRequestException } from '@nestjs/common';
import type { ArgumentMetadata } from '@nestjs/common';
import { UpdateListingDto } from '../../../src/modules/listings/dto/listing.dto.js';
import { InterestedQueryDto } from '../../../src/modules/insights/insights.controller.js';
import { UpdateMeDto } from '../../../src/modules/users/dto/update-me.dto.js';
import { ApiValidationPipe } from '../../../src/common/pipes/api-validation.pipe.js';

const meta = (metatype: unknown): ArgumentMetadata => ({ type: 'body', metatype: metatype as never, data: '' });

describe('ApiValidationPipe', () => {
  it('rejects an explicit null for a field the database does not allow to be empty', async () => {
    await expect(new ApiValidationPipe().transform({ price: null, titleAr: 'شقة' }, meta(UpdateListingDto))).rejects.toThrow(
      BadRequestException,
    );
    await expect(new ApiValidationPipe().transform({ name: null }, meta(UpdateMeDto))).rejects.toThrow(BadRequestException);
  });

  it('keeps intentional clears sent as null, for fields the database allows to be empty', async () => {
    const me = (await new ApiValidationPipe().transform({ phone: null }, meta(UpdateMeDto))) as { phone?: string | null };
    expect(me.phone).toBeNull();
    const listing = (await new ApiValidationPipe().transform({ plan: null, location: null }, meta(UpdateListingDto))) as Record<string, unknown>;
    expect(listing.plan).toBeNull();
    expect(listing.location).toBeNull();
  });

  it('still rejects a body that is invalid for its own sake', async () => {
    await expect(new ApiValidationPipe().transform({ price: -5 }, meta(UpdateListingDto))).rejects.toThrow(BadRequestException);
  });

  it('keeps intentional clears such as an empty-string phone', async () => {
    const value = await new ApiValidationPipe().transform({ phone: '' }, meta(UpdateListingDto));
    expect(value).toMatchObject({ phone: '' });
  });

  it('rejects a null array element with 400, not a crash', async () => {
    await expect(new ApiValidationPipe().transform({ images: ['/uploads/listings/a.jpg', null] }, meta(UpdateListingDto))).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects a fractional page or limit for the interested clients', async () => {
    const query = (metatype: unknown): ArgumentMetadata => ({ type: 'query', metatype: metatype as never, data: '' });
    await expect(new ApiValidationPipe().transform({ page: '1.5' }, query(InterestedQueryDto))).rejects.toThrow(BadRequestException);
    await expect(new ApiValidationPipe().transform({ limit: '20.5' }, query(InterestedQueryDto))).rejects.toThrow(BadRequestException);
  });
});
