-- Migration 0003 : acceptation des avis et conditions d'utilisation (une ligne par version acceptée).
create table terms_acceptances (
  user_id text not null references "user" ("id") on delete cascade,
  version text not null,
  accepted_at integer not null,
  primary key (user_id, version)
);
