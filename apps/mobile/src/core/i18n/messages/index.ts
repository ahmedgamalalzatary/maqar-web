import { common } from './common';
import { account } from './account';
import { admin } from './admin';
import { agent } from './agent';
import { alerts } from './alerts';
import { auth } from './auth';
import { calculator } from './calculator';
import { chat } from './chat';
import { compare } from './compare';
import { home } from './home';
import { listings } from './listings';
import { notifications } from './notifications';
import { prefs } from './prefs';
import { property } from './property';
import { saved } from './saved';
import { tour } from './tour';
import { viewings } from './viewings';

export const m = { common, account, admin, agent, alerts, auth, calculator, chat, compare, home, listings, notifications, prefs, property, saved, tour, viewings } as const;

export type { Message } from './types';
