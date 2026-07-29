# 🌸 MONYS ERP AI
## MASTER PLAN v2.0

**Nombre del sistema:** MONYS OS  
**Proyecto:** MONYS ERP AI  
**Propietaria y Directora General:** Mónica Janeth Jiménez Meza

---

# 1. VISIÓN GENERAL

Construir una plataforma inteligente capaz de administrar, analizar y coordinar todos los negocios de MONYS.

MONYS OS deberá:

- Integrar la información operativa de los negocios.
- Analizar ventas, inventarios, finanzas, personal y logística.
- Detectar riesgos y oportunidades.
- Generar recomendaciones claras.
- Ayudar a tomar decisiones diariamente.
- Permitir que cada usuario vea únicamente las funciones correspondientes a su puesto.

MONYS OS no será solamente un ERP.

Será un sistema de dirección empresarial con Inteligencia Artificial.

Su propósito principal será funcionar como un:

## 👑 Director General Digital

---

# 2. EXPERIENCIA PRINCIPAL

La primera pantalla que abrirá Mony cada día será:

# 👑 Sala de Consejo IA

La Sala de Consejo IA reunirá a todos los Directores IA del sistema.

Cada mañana deberá:

1. Saludar a Mony.
2. Analizar la información disponible.
3. Mostrar el estado general de los negocios.
4. Presentar los indicadores más importantes.
5. Detectar decisiones prioritarias.
6. Permitir consultar a cada Director IA.
7. Recomendar las acciones del día.

En una fase posterior tendrá el botón:

## ▶️ Iniciar reunión

La reunión presentará a cada Director IA uno por uno y finalizará con una conclusión ejecutiva.

---

# 3. CONSEJO DIRECTIVO IA

El Consejo Directivo estará formado por los siguientes Directores IA:

## 👔 Director General IA

Coordina la información de todos los directores y presenta el resumen ejecutivo.

## 💰 Director Financiero IA

Analiza ingresos, gastos, liquidez, flujo de efectivo, pagos y riesgos financieros.

## 🛒 Director Comercial IA

Analiza ventas, piezas vendidas, productos líderes y comportamiento comercial.

## 📦 Director de Inventario IA

Analiza rotación, existencias, faltantes y recomendaciones de resurtido.

## 📢 Director de Marketing IA

Propone campañas, promociones, contenido y oportunidades comerciales.

## 🤝 Director CRI

Administra el Centro de Relaciones Inteligentes.

Analiza clientes, recompra, seguimiento, campañas y oportunidades de contacto.

## 👥 Director de Recursos Humanos IA

Analiza empleados, horarios, incidencias, asistencia y desempeño.

## 🚚 Director Logístico IA

Analiza rutas, camionetas, choferes, costos, pagos e incidencias.

## 🧠 Director de Estrategia IA

Analiza oportunidades de crecimiento, expansión, inversión y nuevos negocios.

---

# 4. MÓDULOS PRINCIPALES

## ✅ Módulos iniciados o funcionales

- Dashboard Ejecutivo.
- Importador SICAR.
- Centro de Inteligencia.
- Sala de Consejo IA.
- Director General IA, versión inicial.
- Director Financiero IA, versión inicial.
- Director Comercial IA, versión inicial.
- Director de Inventario IA, versión inicial.
- Resumen del Consejo Directivo.
- Conexión con Supabase.

## ⬜ Módulos pendientes o en desarrollo

- Decisiones Prioritarias automáticas.
- Botón Iniciar reunión.
- Centro de Relaciones Inteligentes, CRI.
- Ventas.
- Inventario completo.
- Compras Inteligentes.
- Tesorería.
- Marketing.
- Recursos Humanos.
- App de empleados.
- Flotilla Jiménez.
- Reportes Ejecutivos.
- Configuración.
- Usuarios, permisos y roles.
- Notificaciones y alertas.
- Integración completa con Inteligencia Artificial.

---

# 5. NEGOCIOS QUE ADMINISTRARÁ

## 💄 Monys Glam

Negocio de cosméticos con ventas de mayoreo, menudeo y ventas en línea.

Sucursales iniciales:

- Centro.
- General Anaya.

## 🚚 Flotilla Jiménez

Operación de camionetas, rutas, choferes, ingresos, costos, pagos e incidencias.

El sistema deberá permitir agregar nuevos negocios y sucursales en el futuro.

---

# 6. TIPOS DE USUARIO

## 👑 Dueña y Directora General

Acceso completo a todos los negocios, módulos, análisis y decisiones.

## 🧑‍💼 Encargadas

Acceso a la operación de su sucursal, ventas, incidencias, pendientes y reportes autorizados.

## 💄 Marketing

Acceso a productos, campañas, contenido, clientes y resultados comerciales.

## 🧾 Cajeras y vendedoras

Acceso únicamente a las funciones necesarias para su trabajo.

## 🚚 Choferes

Acceso a rutas, solicitudes de dinero, gastos, pagos e incidencias.

Cada usuario deberá ver una pantalla diferente según su rol y permisos.

---

# 7. ARQUITECTURA ACTUAL

La arquitectura debe mantenerse modular.

Estructura actual del área de Inteligencia:

```text
CentroInteligencia.jsx
        │
        ├── SalaConsejoIA.jsx
        │         │
        │         └── MensajeDirectorGeneral.jsx
        │
        ├── DirectorFinanciero.jsx
        ├── DirectorComercial.jsx
        ├── DirectorInventario.jsx
        └── Consejo Directivo