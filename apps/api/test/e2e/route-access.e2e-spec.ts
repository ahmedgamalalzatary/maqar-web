import type { INestApplication } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants.js';
import { ModulesContainer } from '@nestjs/core';
import type { App } from 'supertest/types.js';
import { IS_PUBLIC } from '../../src/common/decorators/public.decorator.js';
import { ROLES_KEY } from '../../src/common/decorators/roles.decorator.js';
import { createTestApp } from '../utils/app.js';

const VERBS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'ALL', 'OPTIONS', 'HEAD', 'SEARCH'];

/**
 * Phase 20 security review (contract §15): who may call every route, read from the running app.
 * Every route needs a sign-in unless it is marked public; @Roles narrows it to those roles.
 * A new route, or a changed guard, fails here until this table is updated on purpose.
 */
const EXPECTED: Record<string, string> = {
  'GET /admin/agents': 'admin',
  'POST /admin/agents': 'admin',
  'PUT /admin/agents/hours': 'admin',
  'POST /admin/agents/days-off': 'admin',
  'GET /admin/agents/:id': 'admin',
  'PATCH /admin/agents/:id': 'admin',
  'POST /admin/agents/:id/reassign': 'admin',
  'DELETE /admin/agents/:id/days-off/:date': 'admin',
  'GET /admin/areas': 'admin',
  'POST /admin/areas': 'admin',
  'PATCH /admin/areas/:id': 'admin',
  'DELETE /admin/areas/:id': 'admin',
  'GET /admin/leads': 'admin',
  'PATCH /admin/leads/:id/assign': 'admin',
  'GET /admin/listings': 'admin',
  'POST /admin/listings': 'admin',
  'GET /admin/listings/:id': 'admin',
  'PATCH /admin/listings/:id': 'admin',
  'POST /admin/listings/:id/publish': 'admin',
  'POST /admin/listings/:id/unpublish': 'admin',
  'POST /admin/listings/:id/close': 'admin',
  'PATCH /admin/listings/:id/price': 'admin',
  'GET /admin/listings/:id/stats': 'admin',
  'GET /admin/listings/:id/interested': 'admin',
  'POST /uploads': 'admin',
  'POST /uploads/panoramas': 'admin',
  'POST /uploads/videos': 'admin',
  'GET /admin/clients': 'admin',
  'GET /admin/clients/:id': 'admin',
  'PATCH /admin/clients/:id': 'admin',
  'DELETE /admin/clients/:id': 'admin',
  'GET /admin/admins': 'admin',
  'POST /admin/admins': 'admin',
  'PATCH /admin/admins/:id': 'admin',
  'GET /admin/viewings': 'admin',
  'PATCH /admin/viewings/:id': 'admin',
  'GET /admin/chats': 'admin',
  'GET /admin/chats/:id': 'admin',
  'GET /admin/chats/:id/messages': 'admin',
  'POST /admin/chats/:id/unblock': 'admin',
  'GET /admin/reports': 'admin',
  'PATCH /admin/reports/:id': 'admin',
  'GET /admin/overview': 'admin',

  'GET /agent/today': 'agent',
  'GET /agent/leads': 'agent',
  'GET /agent/leads/:id': 'agent',
  'PATCH /agent/leads/:id': 'agent',
  'POST /agent/leads/:id/notes': 'agent',

  'GET /favorites': 'client',
  'PUT /favorites/:propertyId': 'client',
  'DELETE /favorites/:propertyId': 'client',
  'GET /alerts': 'client',
  'PUT /alerts/:propertyId': 'client',
  'DELETE /alerts/:propertyId': 'client',
  'GET /properties/recommended': 'client',
  'PUT /me/prefs': 'client',
  'POST /chats': 'client',
  'POST /chats/:id/messages/:messageId/book': 'client',
  'POST /viewings': 'client',
  'PATCH /viewings/:id': 'client',

  'GET /chats': 'agent,client',
  'GET /chats/:id': 'agent,client',
  'GET /chats/:id/messages': 'agent,client',
  'POST /chats/:id/messages': 'agent,client',
  'POST /chats/:id/images': 'agent,client',
  'POST /chats/:id/read': 'agent,client',
  'POST /chats/:id/report': 'agent,client',
  'POST /chats/:id/block': 'agent,client',
  'GET /viewings': 'agent,client',
  'GET /viewings/:id/ics': 'agent,client',

  'GET /me': 'signed-in',
  'PATCH /me': 'signed-in',
  'DELETE /me': 'signed-in',
  'POST /me/push-tokens': 'signed-in',
  'DELETE /me/push-tokens': 'signed-in',
  'GET /notifications': 'signed-in',
  'POST /notifications/read-all': 'signed-in',
  'POST /notifications/test': 'signed-in',
  'POST /notifications/:id/read': 'signed-in',

  'GET /health': 'public',
  'GET /areas': 'public',
  'POST /auth/sign-up': 'public',
  'POST /auth/sign-in': 'public',
  'POST /auth/refresh': 'public',
  'POST /auth/sign-out': 'public',
  'GET /properties': 'public',
  'GET /properties/match-count': 'public',
  'GET /properties/facets': 'public',
  'GET /properties/compare': 'public',
  'GET /properties/:id': 'public',
  'GET /properties/:id/similar': 'public',
  'GET /properties/:id/slots': 'public',
};

const join = (...parts: (string | string[] | undefined)[]) =>
  '/' +
  parts
    .flatMap((p) => (Array.isArray(p) ? p[0] : p) ?? [])
    .flatMap((p) => p.split('/'))
    .filter(Boolean)
    .join('/');

describe('Who may call each route (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('matches the reviewed table, route for route', () => {
    const actual: Record<string, string> = {};
    for (const mod of app.get(ModulesContainer).values()) {
      for (const { metatype } of mod.controllers.values()) {
        if (!metatype || typeof metatype !== 'function') continue;
        const base = Reflect.getMetadata(PATH_METADATA, metatype) as string | string[] | undefined;
        const proto = metatype.prototype as Record<string, unknown>;
        for (const name of Object.getOwnPropertyNames(proto)) {
          const handler = proto[name];
          if (name === 'constructor' || typeof handler !== 'function') continue;
          const path = Reflect.getMetadata(PATH_METADATA, handler) as string | string[] | undefined;
          if (path === undefined) continue;
          const verb = VERBS[Reflect.getMetadata(METHOD_METADATA, handler) as number];
          const pub = Reflect.getMetadata(IS_PUBLIC, handler) ?? Reflect.getMetadata(IS_PUBLIC, metatype);
          const roles = (Reflect.getMetadata(ROLES_KEY, handler) ?? Reflect.getMetadata(ROLES_KEY, metatype)) as string[] | undefined;
          actual[`${verb} ${join(base, path)}`] = pub ? 'public' : roles?.length ? [...roles].sort().join(',') : 'signed-in';
        }
      }
    }
    expect(actual).toEqual(EXPECTED);
  });
});
