-- Migration 0002 : invitations à rejoindre un univers.
-- Le lien d'invitation contient un jeton aléatoire ; seule son empreinte (SHA-256) est gardée ici.
create table invitations (
  id text not null primary key,
  token_hash text not null unique,
  universe_id text not null,
  email text not null,
  role text not null check (role in ('editor', 'contributor', 'reader')),
  invited_by text not null references "user" ("id") on delete cascade,
  created_at integer not null,
  expires_at integer not null,
  accepted_at integer,
  accepted_by text,
  revoked_at integer
);
create index invitations_universe_idx on invitations (universe_id);
