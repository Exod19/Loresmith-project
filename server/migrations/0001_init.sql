-- Migration 0001 : comptes (Better Auth), membres, documents et historique.
-- Rien n'est jamais effacé : une suppression marque le document (`deleted_at`), et chaque version est gardée.

-- Comptes, sessions et vérifications : tables de Better Auth (générées par `getMigrations`, version 1.7).
create table "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" integer not null, "image" text, "createdAt" date not null, "updatedAt" date not null);
create table "session" ("id" text not null primary key, "expiresAt" date not null, "token" text not null unique, "createdAt" date not null, "updatedAt" date not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade);
create table "account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" date, "refreshTokenExpiresAt" date, "scope" text, "password" text, "createdAt" date not null, "updatedAt" date not null);
create table "verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" date not null, "createdAt" date not null, "updatedAt" date not null);
create index "session_userId_idx" on "session" ("userId");
create index "account_userId_idx" on "account" ("userId");
create index "verification_identifier_idx" on "verification" ("identifier");

-- Rôles dans un univers (cf. src/shared/schema.js).
create table universe_members (
  universe_id text not null,
  user_id text not null references "user" ("id") on delete cascade,
  role text not null check (role in ('owner', 'editor', 'contributor', 'reader')),
  created_at integer not null,
  primary key (universe_id, user_id)
);
create index universe_members_user_idx on universe_members (user_id);

-- Rôles dans une campagne.
create table campaign_members (
  campaign_id text not null,
  user_id text not null references "user" ("id") on delete cascade,
  role text not null check (role in ('gm', 'cogm')),
  created_at integer not null,
  primary key (campaign_id, user_id)
);
create index campaign_members_user_idx on campaign_members (user_id);

-- Un document par univers, campagne, élément ou état de compte. `data` : JSON de l'élément.
create table documents (
  type text not null,
  id text not null,
  universe_id text,
  campaign_id text,
  owner_id text,
  created_by text not null,
  version integer not null default 1,
  updated_by text not null,
  updated_at integer not null,
  deleted_at integer,
  data text not null,
  primary key (type, id)
);
create index documents_universe_idx on documents (universe_id, type);
create index documents_campaign_idx on documents (campaign_id);

-- Historique : chaque version écrite d'un document, pour pouvoir revenir en arrière (décision Q5).
create table document_versions (
  type text not null,
  id text not null,
  version integer not null,
  updated_by text not null,
  updated_at integer not null,
  deleted_at integer,
  data text not null,
  primary key (type, id, version)
);

-- Images partagées (lot 5) : le fichier est dans R2, la table dit à quel univers il appartient.
create table images (
  universe_id text not null,
  id text not null,
  r2_key text not null,
  type text not null,
  size integer not null,
  created_by text not null,
  created_at integer not null,
  primary key (universe_id, id)
);
