#!/usr/bin/env python3
"""WMAP · Genera 04_import_excel.sql a partir de WELDING_BOOK_DESARROLLO.xlsx

Uso:  python3 import_excel_to_sql.py WELDING_BOOK_DESARROLLO.xlsx [salida.sql]
Requiere: pip install openpyxl
Hojas: WPS, PQR, PQR-2 (ASME) · WPS-EN, PQR-EN (ISO). 'Hoja1' se ignora.
Genera también informe_importacion.txt con avisos (códigos sin PQR, duplicados...).
"""
import re
import sys
import uuid
import openpyxl

NS = uuid.UUID("6f1c0c1e-0a55-4c7b-9a43-3c0d6a1b7e01")
N_ASME, N_PQR_ISO, N_WPS_ISO = 1, 2, 3
# id de proceso por código AWS / ISO (ver 03_seed_catalogos.sql)
AWS = {"SMAW": 1, "GTAW": 2, "SAW": 3, "FCAW": 4, "GMAW": 5}
ISO = {"111": 1, "141": 2, "12": 3, "136": 4, "135": 5, "121": 6, "131": 7, "138": 8}

avisos = []


def q(v):
    """Literal SQL."""
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


def s(v):
    if v is None:
        return None
    v = str(v).strip()
    return v or None


def num(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    m = re.search(r"-?\d+(?:[.,]\d+)?", str(v))
    return float(m.group().replace(",", ".")) if m else None


def lim(v):
    """'All'/vacío -> None (sin límite); número -> float."""
    t = s(v)
    if t is None or t.lower() == "all":
        return None
    return num(t)


def sino(v):
    return str(v).strip().upper() in ("SI", "SÍ", "YES", "TRUE")


def impacto(v):
    t = s(v)
    if t is None or t.upper() == "NO":
        return None
    return num(t)


def tipo(v):
    t = (s(v) or "").upper()
    if t.startswith("FIL"):
        return "filete"
    return "penetracion"


def grupo(v):
    """'1_2' -> '1,2' (Group ASME con varios valores)."""
    t = s(v)
    return t.replace("_", ",") if t else None


def revision(v):
    m = re.search(r"\d+", str(v or ""))
    return int(m.group()) if m else 0


def procesos(txt, tabla):
    ids = []
    for p in re.split(r"[+/ ]+", str(txt or "").strip()):
        p = p.strip().upper()
        if not p:
            continue
        pid = tabla.get(p) or tabla.get(re.sub(r"\.0$", "", p))
        if pid is None:
            avisos.append(f"Proceso desconocido '{p}' en '{txt}'")
        else:
            ids.append(pid)
    return ids


def uid(*parts):
    return str(uuid.uuid5(NS, "|".join(map(str, parts))))


def filas(ws, desde=2):
    for r in ws.iter_rows(min_row=desde, values_only=True):
        if r and r[0] is not None and str(r[0]).strip():
            yield r


def main():
    src = sys.argv[1]
    out = sys.argv[2] if len(sys.argv) > 2 else "04_import_excel.sql"
    wb = openpyxl.load_workbook(src, data_only=True)
    sql = ["-- Generado por import_excel_to_sql.py desde " + src, "begin;"]
    pqr_ids = {}  # (norma, codigo) -> uuid

    # ---------------- PQR ASME ----------------
    for hoja in ("PQR", "PQR-2"):
        for r in filas(wb[hoja]):
            cod = s(r[0])
            if cod.upper() == "PQR":          # fila de cabecera duplicada
                continue
            key = (N_ASME, cod)
            if key in pqr_ids:
                avisos.append(f"PQR duplicado ({hoja}): {cod}")
                continue
            pid = uid("pqr", N_ASME, cod)
            pqr_ids[key] = pid
            imp = impacto(r[8])
            sql.append(
                "insert into pqr (id,codigo,revision,norma_id,estado,tipo,espesor_mm,"
                "p_no_1,group_1,p_no_2,group_2,clase_material,precalentamiento_c,precalentamiento_txt,"
                "pwht,impacto_temp_c,observaciones) values ("
                f"{q(pid)},{q(cod)},0,{N_ASME},'aprobado',{q(tipo(r[10]))},{q(lim(r[6]))},"
                f"{q(s(r[1]))},{q(grupo(r[2]))},{q(s(r[3]))},{q(grupo(r[4]))},{q(s(r[5]))},"
                f"{q(num(r[7]))},{q(s(r[7]))},{q(sino(r[9]))},{q(imp)},{q(s(r[12]) if len(r) > 12 else None)});"
            )
            for i, p in enumerate(procesos(r[11], AWS), 1):
                sql.append(f"insert into pqr_procesos (pqr_id,orden,proceso_id) values ({q(pid)},{i},{p});")

    # ---------------- PQR EN/ISO ----------------
    for r in filas(wb["PQR-EN"]):
        cod = s(r[0])
        if cod.upper() == "PQR":
            continue
        key = (N_PQR_ISO, cod)
        if key in pqr_ids:
            avisos.append(f"PQR-EN duplicado: {cod}")
            continue
        pid = uid("pqr", N_PQR_ISO, cod)
        pqr_ids[key] = pid
        sql.append(
            "insert into pqr (id,codigo,revision,norma_id,estado,tipo,espesor_mm,grupo_iso_1,grupo_iso_2,observaciones) values ("
            f"{q(pid)},{q(cod)},0,{N_PQR_ISO},'aprobado',{q(tipo(r[7]))},{q(lim(r[5]))},"
            f"{q(s(r[1]))},{q(s(r[3]))},{q(s(r[9]))});"
        )
        for i, p in enumerate(procesos(r[8], ISO), 1):
            sql.append(f"insert into pqr_procesos (pqr_id,orden,proceso_id) values ({q(pid)},{i},{p});")

    # ---------------- vínculo WPS -> PQR ----------------
    def buscar_pqr(norma, token, base):
        """Devuelve lista de ids de PQR para un token de la columna 'PQR' del Excel.
        - 'F024'            -> exacto o, si no existe, todos los que empiecen así (F024A, F024B)
        - 'F026 Supl.'      -> todos los suplementos de F026
        - 'Supl.I', 'Sup.V' -> suplementos del último PQR base citado (aproximado)
        """
        codigos = [c for (n, c) in pqr_ids if n == norma]
        tk = token.strip()
        if re.match(r"(?i)^sup", tk):
            cand = [c for c in codigos if base and c.upper().startswith(base.upper()) and "SUP" in c.upper()]
            return cand, True
        if (norma, tk) in pqr_ids:
            return [tk], False
        cand = [c for c in codigos if c.upper().startswith(tk.upper())]
        return cand, len(cand) > 1

    def vincular(wid, norma, ref, cod, enlazar_a=None):
        if not ref:
            avisos.append(f"WPS sin PQR: {cod}")
            return
        base = None
        for t in [x for x in re.split(r"\s*(?:\+|,|\sy\s)\s*", ref) if x.strip()]:
            m = re.match(r"(?i)^(F\d+[A-Z]?R?)", t.strip())
            if m:
                base = m.group(1)
            cand, aprox = buscar_pqr(norma, t, base)
            if not cand:
                avisos.append(f"WPS {cod}: PQR '{t}' (de '{ref}') no encontrado en la hoja de PQR")
                continue
            if re.search(r"(?i)sup", t) and len(cand) > 1:
                # suplemento ambiguo: no se enlaza (afecta a la validez); queda en pqr_ref_txt
                avisos.append(f"WPS {cod}: '{t}' ambiguo ({', '.join(cand)}) -> NO enlazado, asignar a mano")
                continue
            if aprox:
                avisos.append(f"WPS {cod}: '{t}' enlazado con {', '.join(cand)} (revisar)")
            for c in cand:
                sql.append(f"insert into wps_pqr (wps_id,pqr_id) values ({q(wid)},{q(pqr_ids[(norma, c)])}) on conflict do nothing;")

    # ---------------- WPS ASME ----------------
    vistos = set()
    for r in filas(wb["WPS"]):
        cod = s(r[0])
        if cod.upper() == "WPS":
            continue
        rev = revision(r[15])
        if (cod, rev) in vistos:
            avisos.append(f"WPS duplicado: {cod} rev {rev}")
            continue
        vistos.add((cod, rev))
        wid = uid("wps", N_ASME, cod, rev)
        ref = s(r[14])
        sql.append(
            "insert into wps (id,codigo,revision,norma_id,estado,tipo,p_no_1,group_1,p_no_2,group_2,"
            "clase_material,esp_min_mm,esp_max_mm,arqueo_resanado,precalentamiento_min_c,precalentamiento_txt,"
            "impacto_temp_c,pwht,pqr_ref_txt,observaciones) values ("
            f"{q(wid)},{q(cod)},{rev},{N_ASME},'aprobado',{q(tipo(r[12]))},"
            f"{q(s(r[1]))},{q(grupo(r[2]))},{q(s(r[3]))},{q(grupo(r[4]))},{q(s(r[5]))},"
            f"{q(lim(r[6]))},{q(lim(r[7]))},{q(sino(r[8]))},{q(num(r[9]))},{q(s(r[9]))},"
            f"{q(impacto(r[10]))},{q(sino(r[11]))},{q(ref)},{q(s(r[16]) if len(r) > 16 else None)});"
        )
        for i, p in enumerate(procesos(r[13], AWS), 1):
            sql.append(f"insert into wps_procesos (wps_id,orden,proceso_id) values ({q(wid)},{i},{p});")
        # el PQR base suele ser el prefijo del código si la columna viene vacía
        vincular(wid, N_ASME, ref or cod.split("/")[0].strip(), cod)

    # ---------------- WPS EN/ISO ----------------
    vistos = set()
    for r in filas(wb["WPS-EN"]):
        cod = s(r[0])
        if cod.upper() == "WPS":
            continue
        rev = revision(r[13])
        if (cod, rev) in vistos:
            avisos.append(f"WPS-EN duplicado: {cod} rev {rev}")
            continue
        vistos.add((cod, rev))
        wid = uid("wps", N_WPS_ISO, cod, rev)
        ref = s(r[12])
        gi1 = s(r[2]) or s(r[1])
        gi2 = s(r[4]) or s(r[3])
        sql.append(
            "insert into wps (id,codigo,revision,norma_id,estado,tipo,grupo_iso_1,grupo_iso_2,"
            "esp_min_mm,esp_max_mm,arqueo_resanado,precalentamiento_min_c,precalentamiento_txt,pwht,pqr_ref_txt,observaciones) values ("
            f"{q(wid)},{q(cod)},{rev},{N_WPS_ISO},'aprobado',{q(tipo(r[10]))},{q(gi1)},{q(gi2)},"
            f"{q(lim(r[5]))},{q(lim(r[6]))},{q(sino(r[7]))},{q(num(r[8]))},{q(s(r[8]))},{q(sino(r[9]))},{q(ref)},{q(s(r[14]))});"
        )
        for i, p in enumerate(procesos(r[11], ISO), 1):
            sql.append(f"insert into wps_procesos (wps_id,orden,proceso_id) values ({q(wid)},{i},{p});")
        # los PQR de EN se buscan primero en ISO y, si no, en ASME
        vincular(wid, N_PQR_ISO, ref, cod)

    sql.append("commit;")
    with open(out, "w", encoding="utf-8") as f:
        f.write("\n".join(sql) + "\n")
    with open("informe_importacion.txt", "w", encoding="utf-8") as f:
        f.write(f"PQR importados: {len(pqr_ids)}\nWPS importados: {sum(1 for l in sql if l.startswith('insert into wps ('))}\n")
        f.write(f"Avisos: {len(avisos)}\n\n" + "\n".join(avisos) + "\n")
    print(f"{out}: {len(sql)} sentencias · {len(avisos)} avisos (ver informe_importacion.txt)")


if __name__ == "__main__":
    main()
