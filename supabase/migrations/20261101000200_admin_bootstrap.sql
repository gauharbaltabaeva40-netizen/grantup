-- Платформа админі. Осы email-мен тіркелген пайдаланушы автоматты түрде admin рөлін алады.
-- Жаңа админ қосу үшін: insert into public.admin_emails (email) values ('...');
insert into public.admin_emails (email)
values ('bekzatshemetaev24@gmail.com')
on conflict do nothing;

-- Егер ол бұрын тіркеліп қойған болса
update public.profiles
set role = 'admin'
where email in (select email from public.admin_emails);
