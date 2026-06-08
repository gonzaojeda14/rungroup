-- Rastrea si el usuario ya reclamó el bono único de "Perfil completo"
-- (+5 Flamitas por tener certificado médico + al menos un récord personal).
alter table profiles
  add column if not exists bonus_perfil_otorgado boolean default false;
