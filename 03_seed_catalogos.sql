-- Normas y procesos (IDs fijos: los usa 04_import_excel.sql)
insert into normas (id, codigo, sistema, ambito) values
 (1,'ASME IX','ASME','otro'),
 (2,'EN ISO 15614-1','ISO','PQR'),
 (3,'EN ISO 15609-1','ISO','WPS'),
 (4,'EN ISO 9606-1','ISO','WPQ'),
 (5,'ASME IX (WPQ)','ASME','WPQ')
on conflict (id) do nothing;

insert into procesos (id, codigo_aws, codigo_iso, nombre) values
 (1,'SMAW','111','Arco con electrodo revestido'),
 (2,'GTAW','141','TIG / arco con electrodo de wolframio y gas inerte'),
 (3,'SAW','12','Arco sumergido'),
 (4,'FCAW','136','Arco con alambre tubular con gas activo'),
 (5,'GMAW','135','MAG / arco con alambre sólido y gas activo'),
 (6,'SAW','121','Arco sumergido con alambre macizo'),
 (7,'GMAW','131','MIG / arco con alambre sólido y gas inerte'),
 (8,'GMAW','138','Arco con alambre tubular relleno de polvo metálico con gas activo')
on conflict (id) do nothing;
select setval('normas_id_seq',(select max(id) from normas));
select setval('procesos_id_seq',(select max(id) from procesos));
