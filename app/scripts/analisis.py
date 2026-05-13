import pandas as pd
import numpy as np
import json
import re
import os

# Cargar el archivo de consolidado de indicadores (operativo)
xl_consolidado = pd.ExcelFile('app/public/data/4. CONSOLIDADO_INDICADORES CANCER_SOGAMOSO.xlsx')
print("Hojas en consolidado:", xl_consolidado.sheet_names)

# Cargar el archivo de cumplimiento histórico
xl_historico = pd.ExcelFile('app/public/data/3. Cumplimiento tamizacion 5 años.xlsx')
print("Hojas en histórico:", xl_historico.sheet_names)

# Revisar las primeras filas de cada hoja del consolidado para entender la estructura
for sheet in xl_consolidado.sheet_names:
    df = pd.read_excel(xl_consolidado, sheet_name=sheet, header=None)
    print(f"\n=== {sheet} ===  (filas: {len(df)}, cols: {len(df.columns)})")
    print(df.iloc[:5, :6].to_string())

# Ver todas las columnas de una hoja representativa
sheet = 'Nueva EPS'
df = pd.read_excel(xl_consolidado, sheet_name=sheet, header=0)
print(df.columns.tolist())
print("\nShape:", df.shape)
print(df.head(3).iloc[:, :15].to_string())

# Ver la hoja Consolidado
sheet = 'Consolidado'
df_cons = pd.read_excel(xl_consolidado, sheet_name=sheet, header=0)
print(df_cons.columns.tolist())
print("\nShape:", df_cons.shape)
print(df_cons.head(3).iloc[:, :15].to_string())


# Función para limpiar y extraer datos de cada hoja EPS


def limpiar_hoja_eps(xl, sheet_name):
    df = pd.read_excel(xl, sheet_name=sheet_name, header=0)
    # Renombrar columnas clave para unificar
    df.columns = [str(c).strip().replace('\n', ' ').replace('  ', ' ') for c in df.columns]
    
    # Detectar y renombrar columnas estándar
    rename_map = {}
    for col in df.columns:
        col_upper = col.upper()
        if 'PROGRAMA' in col_upper:
            rename_map[col] = 'PROGRAMA'
        elif 'TIPO INDICADOR' in col_upper:
            rename_map[col] = 'TIPO_INDICADOR'
        elif 'NOMBRE INDICADOR' in col_upper:
            rename_map[col] = 'NOMBRE_INDICADOR'
        elif 'NUMERADOR' in col_upper:
            rename_map[col] = 'NUMERADOR'
        elif 'DENOMINADOR' in col_upper:
            rename_map[col] = 'DENOMINADOR'
        elif 'POBLACION' in col_upper and 'CORTE' in col_upper:
            rename_map[col] = 'POBLACION_CORTE'
        elif 'ESTIMACION' in col_upper:
            rename_map[col] = 'ESTIMACION'
        elif 'META' in col_upper and '2026' in col_upper:
            rename_map[col] = 'META_2026'
        elif 'LINEA BASE' in col_upper or 'LINEA_BASE' in col_upper:
            rename_map[col] = 'LINEA_BASE_2025'
        elif 'ACUMULADO' in col_upper and 'ACTIVIDADES' in col_upper:
            rename_map[col] = 'ACUMULADO_ACTIVIDADES'
        elif '% EJECUCION' in col_upper or 'EJECUCION' in col_upper:
            rename_map[col] = 'PCT_EJECUCION'
        elif 'POBLACION REPORTADA' in col_upper:
            rename_map[col] = 'POBLACION_REPORTADA_EPS'
    
    # Meses
    meses = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']
    for mes in meses:
        for col in df.columns:
            if mes in col.upper():
                rename_map[col] = mes
                break
    
    df = df.rename(columns=rename_map)
    df['EPS'] = sheet_name.strip()
    return df

# Extraer todas las hojas EPS relevantes
hojas_eps = ['Nueva EPS', 'Sanitas', 'Coosalud', 'Famisanar', 'Salud Total', 'Proteger']
dfs_eps = []
for sheet in hojas_eps:
    try:
        dfx = limpiar_hoja_eps(xl_consolidado, sheet)
        dfs_eps.append(dfx)
        print(f"{sheet}: {dfx.shape}")
    except Exception as e:
        print(f"Error en {sheet}: {e}")

# Unificar
df_operativo = pd.concat(dfs_eps, ignore_index=True)
print("\nTotal operativo unificado:", df_operativo.shape)
print(df_operativo[['PROGRAMA','TIPO_INDICADOR','EPS','ENERO','FEBRERO','MARZO','ACUMULADO_ACTIVIDADES','PCT_EJECUCION']].head(10).to_string())

# Procesar archivo histórico
df_hist = pd.read_excel(xl_historico, sheet_name='cumplimiento 5 años', header=0)
print("Histórico shape:", df_hist.shape)
print(df_hist.columns.tolist())
print(df_hist.head(10).to_string())

# Limpiar histórico: convertir todo a float, manejar comas como decimales
def clean_pct(x):
    if pd.isna(x):
        return None
    s = str(x).strip()
    s = s.replace('%', '')
    # Si hay coma pero no punto, y parece decimal (ej: 11,1)
    if ',' in s and '.' not in s:
        s = s.replace(',', '.')
    # Si hay ambos, la coma es separador de miles
    s = s.replace(',', '')
    try:
        return float(s)
    except:
        return None

df_hist_clean = df_hist.copy()
for col in [2021, 2022, 2023, 2024, 2025]:
    df_hist_clean[col] = df_hist_clean[col].apply(clean_pct)

# Renombrar indicadores para estandarizar
indicador_map = {
    'Tamizacion cancer de colon y recto': 'Colon y Recto',
    'Tamizaje cancer de cuello uterino': 'Cuello Uterino',
    'Tamizaje cancer de cuello uterino - citologia': 'Cuello Uterino - Citología',
    'Tamizaje cancer de cuello uterino - ADN VPH': 'Cuello Uterino - ADN VPH',
    'Tamizaje cancer de mama': 'Mama',
    'Tamizaje cancer de prostata': 'Próstata',
    'Tamizaje cancer de prostata-PSA': 'Próstata - PSA',
    'Tamizaje cancer de prostata- tato rectal': 'Próstata - Tacto Rectal'
}
df_hist_clean['INDICADOR_CLEAN'] = df_hist_clean['INDICADOR '].str.strip().map(indicador_map).fillna(df_hist_clean['INDICADOR '].str.strip())
df_hist_clean['EPS_CLEAN'] = df_hist_clean['EPS'].str.strip().str.title()

# Reshape para formato largo
df_hist_long = df_hist_clean.melt(id_vars=['INDICADOR_CLEAN', 'EPS_CLEAN'], value_vars=[2021,2022,2023,2024,2025], var_name='AÑO', value_name='VALOR')
df_hist_long = df_hist_long.dropna(subset=['VALOR'])
print("Histórico largo:", df_hist_long.shape)
print(df_hist_long.head(15).to_string())

# Corregir: valores >1 que claramente son porcentajes (como 11.1% -> 0.111)
# Pero cuidado: hay indicadores donde valores pueden ser conteos (como población)
# En histórico solo hay tasas (0-1 aprox), así que todo >1 probablemente es % sin dividir
def fix_pct_scale(val):
    if val is None:
        return None
    if val > 1:
        return val / 100.0
    return val

df_hist_long['VALOR'] = df_hist_long['VALOR'].apply(fix_pct_scale)
print(df_hist_long.head(15).to_string())

# Ahora procesar la hoja Consolidado del archivo 1
sheet = 'Consolidado'
df_cons = pd.read_excel(xl_consolidado, sheet_name=sheet, header=0)
df_cons.columns = [str(c).strip().replace('\n', ' ').replace('  ', ' ') for c in df_cons.columns]
print("\nConsolidado cols:", df_cons.columns.tolist())
print(df_cons.head(5).to_string())

# Limpiar dataset operativo: quitar filas sin programa o tipo indicador, limpiar meses
meses = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']

# Filtrar solo filas con programa válido
df_op = df_operativo[df_operativo['PROGRAMA'].notna() & (df_operativo['PROGRAMA'] != '')].copy()

# Normalizar nombres de programa
df_op['PROGRAMA'] = df_op['PROGRAMA'].str.strip().str.title()

# Asegurar que las columnas de meses existan y sean numéricas
for m in meses:
    if m in df_op.columns:
        df_op[m] = pd.to_numeric(df_op[m], errors='coerce')

# Convertir acumulado y ejecución
df_op['ACUMULADO_ACTIVIDADES'] = pd.to_numeric(df_op['ACUMULADO_ACTIVIDADES'], errors='coerce')
df_op['PCT_EJECUCION'] = pd.to_numeric(df_op['PCT_EJECUCION'], errors='coerce')
df_op['META_2026'] = pd.to_numeric(df_op['META_2026'], errors='coerce')
df_op['POBLACION_CORTE'] = pd.to_numeric(df_op['POBLACION_CORTE'], errors='coerce')
df_op['ESTIMACION'] = pd.to_numeric(df_op['ESTIMACION'], errors='coerce')

# Normalizar EPS
df_op['EPS'] = df_op['EPS'].str.strip().str.title()

# Limpiar TIPO_INDICADOR
df_op['TIPO_INDICADOR'] = df_op['TIPO_INDICADOR'].str.strip().str.upper()

print("Operativo limpio shape:", df_op.shape)
print(df_op[['PROGRAMA','TIPO_INDICADOR','EPS','ENERO','FEBRERO','MARZO','ACUMULADO_ACTIVIDADES','META_2026','PCT_EJECUCION']].head(15).to_string())

# Crear dataset de funnel para cada programa y EPS
# Para cada programa necesito los stages:

programas_funnel = {
    'Dt Cervix': {
        'stages': [
            ('COBERTURA CCU', 'CCU Realizadas'),
            ('POSITIVIDAD CCU', 'CCU Anormales'),
            ('COBERTURA ADN VPH', 'ADN VPH Realizados'),
            ('POSITIVIDAD ADN VPH', 'ADN VPH Positivos'),
            ('COBERTURA COLPOSCOPIA Y  BIOPSIA', 'Colposcopia + Biopsia')
        ],
        'elegible_label': 'Mujeres 25-65 años'
    },
    'Dt Mama': {
        'stages': [
            ('COBERTURA EXAMEN CLINICO DE LA MAMA', 'Examen Clínico Mama'),
            ('COBERTURA MAMOGRAFIA', 'Mamografías'),
            ('POSITIVIDAD MAMOGRAFIA', 'Mamografías BI-RADS 4+'),
            ('COBERTURA BIOPSIA DE MAMA', 'Biopsias de Mama')
        ],
        'elegible_label': 'Mujeres 40-69 años'
    },
    'Dt Prostata': {
        'stages': [
            ('COBERTURA TACTO RECTAL', 'Tacto Rectal'),
            ('COBERTURA PSA', 'PSA'),
            ('COBERTURA  (PSA   Y TACTO RECTAL)', 'Tamizaje Combinado'),
            ('POSITIVIDAD CANCER DE PROSTATA', 'Resultados Anormales'),
            ('COBERTURA BIOPSIA DE PROSTATA', 'Biopsias de Próstata')
        ],
        'elegible_label': 'Hombres 50-75 años'
    },
    'Dt Colon Y Recto': {
        'stages': [
            ('COBERTURA TAMIZACION SANGRE OCULTA EN HECES', 'SOMF Realizadas'),
            ('POSITIVIDAD SANGRE OCULTA EN HECES', 'SOMF Positivas'),
            ('COBERTURA COLONOSCOPIA', 'Colonoscopias')
        ],
        'elegible_label': 'Personas 50-75 años'
    }
}

funnels = []
for prog, info in programas_funnel.items():
    for eps in df_op['EPS'].unique():
        # Población elegible (tomar del primer indicador de cobertura)
        first_ind = info['stages'][0][0]
        pop_row = df_op[(df_op['PROGRAMA']==prog) & (df_op['TIPO_INDICADOR']==first_ind) & (df_op['EPS']==eps)]
        poblacion = pop_row['POBLACION_CORTE'].values[0] if len(pop_row)>0 else None
        
        for tipo_ind, label in info['stages']:
            row = df_op[(df_op['PROGRAMA']==prog) & (df_op['TIPO_INDICADOR']==tipo_ind) & (df_op['EPS']==eps)]
            if len(row)>0:
                acum = row['ACUMULADO_ACTIVIDADES'].values[0]
                meta = row['META_2026'].values[0]
                pct = row['PCT_EJECUCION'].values[0]
                funnels.append({
                    'programa': prog,
                    'eps': eps,
                    'stage': label,
                    'tipo_indicador': tipo_ind,
                    'poblacion_elegible': poblacion,
                    'acumulado': acum if pd.notna(acum) else 0,
                    'meta': meta if pd.notna(meta) else None,
                    'pct_ejecucion': pct if pd.notna(pct) else None,
                    'enero': row['ENERO'].values[0] if 'ENERO' in row.columns and len(row)>0 else None,
                    'febrero': row['FEBRERO'].values[0] if 'FEBRERO' in row.columns and len(row)>0 else None,
                    'marzo': row['MARZO'].values[0] if 'MARZO' in row.columns and len(row)>0 else None,
                })

df_funnel = pd.DataFrame(funnels)
print("Funnel shape:", df_funnel.shape)
print(df_funnel[df_funnel['eps']=='Nueva Eps'].to_string())

# Crear alertas
alertas = []

for eps in df_op['EPS'].unique():
    for prog in df_op['PROGRAMA'].unique():
        df_eps_prog = df_op[(df_op['EPS']==eps) & (df_op['PROGRAMA']==prog)]
        
        # Alerta 1: Mama - Positividad mamografía > 0 pero biopsia = 0 o NaN
        pos_mama = df_eps_prog[df_eps_prog['TIPO_INDICADOR']=='POSITIVIDAD MAMOGRAFIA']
        bio_mama = df_eps_prog[df_eps_prog['TIPO_INDICADOR']=='COBERTURA BIOPSIA DE MAMA']
        if len(pos_mama)>0 and len(bio_mama)>0:
            val_pos = pos_mama['ACUMULADO_ACTIVIDADES'].values[0]
            val_bio = bio_mama['ACUMULADO_ACTIVIDADES'].values[0]
            if pd.notna(val_pos) and val_pos > 0 and (pd.isna(val_bio) or val_bio == 0):
                alertas.append({
                    'nivel': 'crítico',
                    'programa': prog,
                    'eps': eps,
                    'tipo': 'Biopsia pendiente',
                    'mensaje': f'{eps}: {int(val_pos)} mamografías BI-RADS 4+ sin biopsia de mama confirmada'
                })
        
        # Alerta 2: Próstata - Positividad > 0 pero biopsia = 0
        pos_pros = df_eps_prog[df_eps_prog['TIPO_INDICADOR']=='POSITIVIDAD CANCER DE PROSTATA']
        bio_pros = df_eps_prog[df_eps_prog['TIPO_INDICADOR']=='COBERTURA BIOPSIA DE PROSTATA']
        if len(pos_pros)>0 and len(bio_pros)>0:
            val_pos = pos_pros['ACUMULADO_ACTIVIDADES'].values[0]
            val_bio = bio_pros['ACUMULADO_ACTIVIDADES'].values[0]
            if pd.notna(val_pos) and val_pos > 0 and (pd.isna(val_bio) or val_bio == 0):
                alertas.append({
                    'nivel': 'crítico',
                    'programa': prog,
                    'eps': eps,
                    'tipo': 'Biopsia pendiente',
                    'mensaje': f'{eps}: {int(val_pos)} tamizajes anormales de próstata sin biopsia confirmada'
                })
        
        # Alerta 3: Colon - SOMF positivas > 0 pero colonoscopia = 0
        pos_col = df_eps_prog[df_eps_prog['TIPO_INDICADOR']=='POSITIVIDAD SANGRE OCULTA EN HECES']
        col_col = df_eps_prog[df_eps_prog['TIPO_INDICADOR']=='COBERTURA COLONOSCOPIA']
        if len(pos_col)>0 and len(col_col)>0:
            val_pos = pos_col['ACUMULADO_ACTIVIDADES'].values[0]
            val_col = col_col['ACUMULADO_ACTIVIDADES'].values[0]
            if pd.notna(val_pos) and val_pos > 0 and (pd.isna(val_col) or val_col == 0):
                alertas.append({
                    'nivel': 'crítico',
                    'programa': prog,
                    'eps': eps,
                    'tipo': 'Colonoscopia pendiente',
                    'mensaje': f'{eps}: {int(val_pos)} SOMF positivas sin colonoscopia'
                })
        
        # Alerta 4: Cervix - Colposcopia baja vs CCU anormales
        ccu_anorm = df_eps_prog[df_eps_prog['TIPO_INDICADOR']=='POSITIVIDAD CCU']
        colp = df_eps_prog[df_eps_prog['TIPO_INDICADOR']=='COBERTURA COLPOSCOPIA Y  BIOPSIA']
        if len(ccu_anorm)>0 and len(colp)>0:
            val_ccu = ccu_anorm['ACUMULADO_ACTIVIDADES'].values[0]
            val_colp = colp['ACUMULADO_ACTIVIDADES'].values[0]
            if pd.notna(val_ccu) and val_ccu > 0 and pd.notna(val_colp) and val_colp < val_ccu:
                alertas.append({
                    'nivel': 'alto',
                    'programa': prog,
                    'eps': eps,
                    'tipo': 'Resolución incompleta',
                    'mensaje': f'{eps}: {int(val_ccu)} citologías anormales, solo {int(val_colp)} colposcopias/biopsias'
                })

# Alerta 5: Coberturas muy bajas (<10%) en programas principales
coberturas_bajas = df_op[df_op['TIPO_INDICADOR'].isin([
    'COBERTURA CCU', 'COBERTURA ADN VPH', 'COBERTURA MAMOGRAFIA', 
    'COBERTURA PSA', 'COBERTURA TACTO RECTAL', 'COBERTURA TAMIZACION SANGRE OCULTA EN HECES'
])].copy()
for _, row in coberturas_bajas.iterrows():
    if pd.notna(row['PCT_EJECUCION']) and row['PCT_EJECUCION'] < 0.10 and row['ACUMULADO_ACTIVIDADES'] > 0:
        alertas.append({
            'nivel': 'medio',
            'programa': row['PROGRAMA'],
            'eps': row['EPS'],
            'tipo': 'Cobertura baja',
            'mensaje': f"{row['EPS']}: {row['TIPO_INDICADOR']} solo {row['PCT_EJECUCION']*100:.1f}% de meta"
        })

df_alertas = pd.DataFrame(alertas)
print(f"Total alertas: {len(df_alertas)}")
print(df_alertas.to_string())

# Crear los datasets JSON para el dashboard
out_dir = '/mnt/agents/output/app/public/data'
os.makedirs(out_dir, exist_ok=True)

# 1. KPIs resumidos por programa (tomando Total Municipio del histórico 2025 como referencia, + operativo 2026)
kpis = []

# Programas y sus indicadores principales de cobertura
kpi_map = {
    'Dt Cervix': [
        ('COBERTURA CCU', 'Cobertura CCU'),
        ('COBERTURA ADN VPH', 'Cobertura ADN VPH')
    ],
    'Dt Mama': [
        ('COBERTURA EXAMEN CLINICO DE LA MAMA', 'Examen Clínico Mama'),
        ('COBERTURA MAMOGRAFIA', 'Cobertura Mamografía')
    ],
    'Dt Prostata': [
        ('COBERTURA TACTO RECTAL', 'Tacto Rectal'),
        ('COBERTURA PSA', 'Cobertura PSA')
    ],
    'Dt Colon Y Recto': [
        ('COBERTURA TAMIZACION SANGRE OCULTA EN HECES', 'Cobertura SOMF')
    ]
}

for prog, indicadores in kpi_map.items():
    for tipo, label in indicadores:
        # Total municipio acumulado 2026
        row_total = df_op[(df_op['PROGRAMA']==prog) & (df_op['TIPO_INDICADOR']==tipo)]
        acum_total = row_total['ACUMULADO_ACTIVIDADES'].sum() if len(row_total)>0 else 0
        meta_total = row_total['META_2026'].sum() if len(row_total)>0 else 0
        # Histórico 2025 total municipio
        hist_row = df_hist_long[(df_hist_long['INDICADOR_CLEAN'].str.contains(label.split()[-1], case=False)) & 
                                (df_hist_long['EPS_CLEAN']=='Total Municipio') & (df_hist_long['AÑO']==2025)]
        # Mejor extraer del consolidado o directamente de la hoja Consolidado
        # Usar el acumulado del operativo como valor actual
        poblacion = row_total['POBLACION_CORTE'].sum() if len(row_total)>0 else None
        
        # Calcular tasa de cobertura sobre población
        tasa = acum_total / poblacion if poblacion and poblacion>0 else None
        
        kpis.append({
            'programa': prog,
            'indicador': tipo,
            'label': label,
            'acumulado_2026': acum_total,
            'meta_2026': meta_total,
            'poblacion': poblacion,
            'tasa_cobertura': round(tasa, 4) if tasa else None,
            'pct_avance_meta': round(acum_total/meta_total, 4) if meta_total and meta_total>0 else None
        })

df_kpis = pd.DataFrame(kpis)
print(df_kpis.to_string())

# 2. Dataset operativo mensual (largo)
meses = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']
df_mensual = df_op.melt(
    id_vars=['PROGRAMA','TIPO_INDICADOR','EPS','ACUMULADO_ACTIVIDADES','META_2026','PCT_EJECUCION','POBLACION_CORTE'],
    value_vars=[m for m in meses if m in df_op.columns],
    var_name='MES', value_name='VALOR_MES'
).dropna(subset=['VALOR_MES'])
df_mensual['VALOR_MES'] = pd.to_numeric(df_mensual['VALOR_MES'], errors='coerce')
df_mensual = df_mensual.dropna(subset=['VALOR_MES'])
print("\nMensual shape:", df_mensual.shape)

# 3. Guardar todo
with open(f'{out_dir}/kpis.json', 'w', encoding='utf-8') as f:
    json.dump(df_kpis.to_dict(orient='records'), f, ensure_ascii=False, indent=2)

with open(f'{out_dir}/funnel.json', 'w', encoding='utf-8') as f:
    json.dump(df_funnel.to_dict(orient='records'), f, ensure_ascii=False, indent=2)

with open(f'{out_dir}/historico.json', 'w', encoding='utf-8') as f:
    json.dump(df_hist_long.to_dict(orient='records'), f, ensure_ascii=False, indent=2)

with open(f'{out_dir}/operativo_mensual.json', 'w', encoding='utf-8') as f:
    json.dump(df_mensual.to_dict(orient='records'), f, ensure_ascii=False, indent=2)

with open(f'{out_dir}/alertas.json', 'w', encoding='utf-8') as f:
    json.dump(df_alertas.to_dict(orient='records'), f, ensure_ascii=False, indent=2)

# 4. Dataset consolidado (hoja consolidado) reshaped
df_cons_clean = df_cons[['PROGRAMA','TIPO INDICADOR','NOMBRE INDICADOR','Nueva EPS','Sanitas','Coosalud','Famisanar','Salud total','Cajacopi','Avance en el cumplimiento']].copy()
df_cons_clean.columns = ['PROGRAMA','TIPO_INDICADOR','NOMBRE_INDICADOR','Nueva_Eps','Sanitas','Coosalud','Famisanar','Salud_Total','Cajacopi','Avance_Cumplimiento']
df_cons_melt = df_cons_clean.melt(id_vars=['PROGRAMA','TIPO_INDICADOR','NOMBRE_INDICADOR'], 
                                  value_vars=['Nueva_Eps','Sanitas','Coosalud','Famisanar','Salud_Total','Cajacopi'],
                                  var_name='EPS', value_name='EJECUCION')
df_cons_melt['EJECUCION'] = pd.to_numeric(df_cons_melt['EJECUCION'], errors='coerce')
df_cons_melt['Avance_Cumplimiento'] = pd.to_numeric(df_cons_melt['Avance_Cumplimiento'], errors='coerce')
print("\nConsolidado melt:", df_cons_melt.head(10).to_string())

with open(f'{out_dir}/consolidado_eps.json', 'w', encoding='utf-8') as f:
    json.dump(df_cons_melt.to_dict(orient='records'), f, ensure_ascii=False, indent=2)

# 5. Burn-up: acumulado mensual por programa (sumando todas las EPS)
df_burn = df_mensual.groupby(['PROGRAMA','MES'])['VALOR_MES'].sum().reset_index()
# Ordenar meses
orden_meses = {m:i for i,m in enumerate(meses)}
df_burn = df_burn[df_burn['MES'].isin(orden_meses)]
df_burn['MES_ORDEN'] = df_burn['MES'].map(orden_meses)
df_burn = df_burn.sort_values(['PROGRAMA','MES_ORDEN'])
df_burn['ACUMULADO_CALCULADO'] = df_burn.groupby('PROGRAMA')['VALOR_MES'].cumsum()
print("\nBurn-up:", df_burn.to_string())

with open(f'{out_dir}/burnup.json', 'w', encoding='utf-8') as f:
    json.dump(df_burn.to_dict(orient='records'), f, ensure_ascii=False, indent=2)

print("\n✅ Todos los JSON guardados en", out_dir)

# Corregir el error del consolidado
# La columna Avance en el cumplimiento pertenece a cada fila (indicador), no a cada EPS
# Así que debo mergearla después del melt

df_cons_clean = df_cons[['PROGRAMA','TIPO INDICADOR','NOMBRE INDICADOR',
                         'Nueva EPS','Sanitas','Coosalud','Famisanar','Salud total','Cajacopi',
                         'Avance en el cumplimiento']].copy()
df_cons_clean.columns = ['PROGRAMA','TIPO_INDICADOR','NOMBRE_INDICADOR',
                         'Nueva_Eps','Sanitas','Coosalud','Famisanar','Salud_Total','Cajacopi',
                         'Avance_Cumplimiento']

# Hacer melt solo para las columnas EPS
df_cons_melt = df_cons_clean.melt(
    id_vars=['PROGRAMA','TIPO_INDICADOR','NOMBRE_INDICADOR','Avance_Cumplimiento'], 
    value_vars=['Nueva_Eps','Sanitas','Coosalud','Famisanar','Salud_Total','Cajacopi'],
    var_name='EPS', value_name='EJECUCION'
)
df_cons_melt['EJECUCION'] = pd.to_numeric(df_cons_melt['EJECUCION'], errors='coerce')
df_cons_melt['Avance_Cumplimiento'] = pd.to_numeric(df_cons_melt['Avance_Cumplimiento'], errors='coerce')
print("Consolidado melt head:", df_cons_melt.head(10).to_string())

with open(f'{out_dir}/consolidado_eps.json', 'w', encoding='utf-8') as f:
    json.dump(df_cons_melt.to_dict(orient='records'), f, ensure_ascii=False, indent=2)

# Re-guardar burnup también
with open(f'{out_dir}/burnup.json', 'w', encoding='utf-8') as f:
    json.dump(df_burn.to_dict(orient='records'), f, ensure_ascii=False, indent=2)

print("\n✅ JSONs actualizados correctamente")

# Recalcular y guardar burnup
meses = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO','AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE']

# Dataset operativo mensual ya existe como df_mensual? Vamos a recrearlo
meses_presentes = [m for m in meses if m in df_op.columns]
df_mensual = df_op.melt(
    id_vars=['PROGRAMA','TIPO_INDICADOR','EPS','ACUMULADO_ACTIVIDADES','META_2026','PCT_EJECUCION','POBLACION_CORTE'],
    value_vars=meses_presentes,
    var_name='MES', value_name='VALOR_MES'
).dropna(subset=['VALOR_MES'])
df_mensual['VALOR_MES'] = pd.to_numeric(df_mensual['VALOR_MES'], errors='coerce')
df_mensual = df_mensual.dropna(subset=['VALOR_MES'])

# Burn-up: acumulado mensual por programa (sumando todas las EPS)
df_burn = df_mensual.groupby(['PROGRAMA','MES'])['VALOR_MES'].sum().reset_index()
orden_meses = {m:i for i,m in enumerate(meses)}
df_burn = df_burn[df_burn['MES'].isin(orden_meses)]
df_burn['MES_ORDEN'] = df_burn['MES'].map(orden_meses)
df_burn = df_burn.sort_values(['PROGRAMA','MES_ORDEN'])
df_burn['ACUMULADO_CALCULADO'] = df_burn.groupby('PROGRAMA')['VALOR_MES'].cumsum()

# Guardar burnup
with open(f'{out_dir}/burnup.json', 'w', encoding='utf-8') as f:
    json.dump(df_burn.to_dict(orient='records'), f, ensure_ascii=False, indent=2)

print("Burn-up guardado. Shape:", df_burn.shape)
print(df_burn.to_string())

# Verificar que todos los archivos existen
for fname in ['kpis.json','funnel.json','historico.json','operativo_mensual.json','alertas.json','consolidado_eps.json','burnup.json']:
    path = f'{out_dir}/{fname}'
    size = os.path.getsize(path) if os.path.exists(path) else 0
    print(f"  {fname}: {size} bytes")
