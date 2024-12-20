alter table "auth"."mfa_challenges" add column if not exists "web_authn_session_data" jsonb;

alter table "auth"."mfa_factors" add column if not exists "web_authn_aaguid" uuid;

alter table "auth"."mfa_factors" add column if not exists "web_authn_credential" jsonb;


set check_function_bodies = off;

CREATE OR REPLACE FUNCTION storage.extension(name text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
_parts text[];
_filename text;
BEGIN
    select string_to_array(name, '/') into _parts;
    select _parts[array_length(_parts,1)] into _filename;
    -- @todo return the last part instead of 2
    return split_part(_filename, '.', 2);
END
$function$
;

CREATE OR REPLACE FUNCTION storage.filename(name text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
_parts text[];
BEGIN
    select string_to_array(name, '/') into _parts;
    return _parts[array_length(_parts,1)];
END
$function$
;

CREATE OR REPLACE FUNCTION storage.foldername(name text)
 RETURNS text[]
 LANGUAGE plpgsql
AS $function$
DECLARE
_parts text[];
BEGIN
    select string_to_array(name, '/') into _parts;
    return _parts[1:array_length(_parts,1)-1];
END
$function$
;

grant delete on table "storage"."s3_multipart_uploads" to "postgres";

grant insert on table "storage"."s3_multipart_uploads" to "postgres";

grant references on table "storage"."s3_multipart_uploads" to "postgres";

grant select on table "storage"."s3_multipart_uploads" to "postgres";

grant trigger on table "storage"."s3_multipart_uploads" to "postgres";

grant truncate on table "storage"."s3_multipart_uploads" to "postgres";

grant update on table "storage"."s3_multipart_uploads" to "postgres";

grant delete on table "storage"."s3_multipart_uploads_parts" to "postgres";

grant insert on table "storage"."s3_multipart_uploads_parts" to "postgres";

grant references on table "storage"."s3_multipart_uploads_parts" to "postgres";

grant select on table "storage"."s3_multipart_uploads_parts" to "postgres";

grant trigger on table "storage"."s3_multipart_uploads_parts" to "postgres";

grant truncate on table "storage"."s3_multipart_uploads_parts" to "postgres";

grant update on table "storage"."s3_multipart_uploads_parts" to "postgres";

create policy " Problem contributors can access their own images c3v78m_0"
on "storage"."objects"
as permissive
for select
to public
using (((bucket_id = 'problem-images'::text) AND (auth.uid() = owner) AND (storage.extension(name) = ANY (ARRAY['jpg'::text, 'jpeg'::text, 'png'::text, 'webp'::text]))));


create policy " Problem contributors can access their own images c3v78m_1"
on "storage"."objects"
as permissive
for insert
to public
with check (((bucket_id = 'problem-images'::text) AND (auth.uid() = owner) AND (storage.extension(name) = ANY (ARRAY['jpg'::text, 'jpeg'::text, 'png'::text, 'webp'::text]))));


create policy " Problem contributors can access their own images c3v78m_2"
on "storage"."objects"
as permissive
for update
to public
using (((bucket_id = 'problem-images'::text) AND (auth.uid() = owner) AND (storage.extension(name) = ANY (ARRAY['jpg'::text, 'jpeg'::text, 'png'::text, 'webp'::text]))));


create policy " Problem contributors can access their own images c3v78m_3"
on "storage"."objects"
as permissive
for delete
to public
using (((bucket_id = 'problem-images'::text) AND (auth.uid() = owner) AND (storage.extension(name) = ANY (ARRAY['jpg'::text, 'jpeg'::text, 'png'::text, 'webp'::text]))));


create policy "Give anon users access to JPG images in all folder 1t1ml2_1"
on "storage"."objects"
as permissive
for insert
to anon
with check (((bucket_id = 'scans'::text) AND (auth.role() = 'anon'::text)));


create policy "Give anon users access to json files in folder 1w99p_0"
on "storage"."objects"
as permissive
for select
to public
using (((bucket_id = 'guts'::text) AND (storage.extension(name) = 'json'::text) AND (( SELECT user_roles.role
   FROM user_roles
  WHERE (user_roles.user_id = auth.uid())) >= 40)));


create policy "Give anon users access to json files in folder 1w99p_1"
on "storage"."objects"
as permissive
for insert
to public
with check (((bucket_id = 'guts'::text) AND (storage.extension(name) = 'json'::text) AND (( SELECT user_roles.role
   FROM user_roles
  WHERE (user_roles.user_id = auth.uid())) >= 40)));


create policy "Give anon users access to json files in folder 1w99p_2"
on "storage"."objects"
as permissive
for update
to public
using (((bucket_id = 'guts'::text) AND (storage.extension(name) = 'json'::text) AND (( SELECT user_roles.role
   FROM user_roles
  WHERE (user_roles.user_id = auth.uid())) >= 40)));


create policy "Let admin users upsert pngs in scans 1t1ml2_0"
on "storage"."objects"
as permissive
for insert
to public
with check (((bucket_id = 'scans'::text) AND (storage.extension(name) = 'png'::text) AND (( SELECT user_roles.role
   FROM user_roles
  WHERE (user_roles.user_id = auth.uid())) >= 40)));


create policy "Let admin users upsert pngs in scans 1t1ml2_1"
on "storage"."objects"
as permissive
for update
to public
using (((bucket_id = 'scans'::text) AND (storage.extension(name) = 'png'::text) AND (( SELECT user_roles.role
   FROM user_roles
  WHERE (user_roles.user_id = auth.uid())) >= 40)));


create policy "Let admin users upsert pngs in scans 1t1ml2_2"
on "storage"."objects"
as permissive
for select
to public
using (((bucket_id = 'scans'::text) AND (storage.extension(name) = 'png'::text) AND (( SELECT user_roles.role
   FROM user_roles
  WHERE (user_roles.user_id = auth.uid())) >= 40)));


create policy "Problem writers can do anything c3v78m_0"
on "storage"."objects"
as permissive
for select
to public
using (((bucket_id = 'problem-images'::text) AND (( SELECT user_roles.role
   FROM user_roles
  WHERE (user_roles.user_id = auth.uid())) >= 30) AND (storage.extension(name) = ANY (ARRAY['jpg'::text, 'png'::text, 'jpeg'::text, 'webp'::text]))));


create policy "Problem writers can do anything c3v78m_1"
on "storage"."objects"
as permissive
for insert
to public
with check (((bucket_id = 'problem-images'::text) AND (( SELECT user_roles.role
   FROM user_roles
  WHERE (user_roles.user_id = auth.uid())) >= 30) AND (storage.extension(name) = ANY (ARRAY['jpg'::text, 'png'::text, 'jpeg'::text, 'webp'::text]))));


create policy "Problem writers can do anything c3v78m_2"
on "storage"."objects"
as permissive
for update
to public
using (((bucket_id = 'problem-images'::text) AND (( SELECT user_roles.role
   FROM user_roles
  WHERE (user_roles.user_id = auth.uid())) >= 30) AND (storage.extension(name) = ANY (ARRAY['jpg'::text, 'png'::text, 'jpeg'::text, 'webp'::text]))));


create policy "Problem writers can do anything c3v78m_3"
on "storage"."objects"
as permissive
for delete
to public
using (((bucket_id = 'problem-images'::text) AND (( SELECT user_roles.role
   FROM user_roles
  WHERE (user_roles.user_id = auth.uid())) >= 30) AND (storage.extension(name) = ANY (ARRAY['jpg'::text, 'png'::text, 'jpeg'::text, 'webp'::text]))));



