# Funciones IA: alcance y privilegios

Estas protecciones verifican acceso, no certifican todo el sistema ni exactitud de la IA.

| Función | Quién puede llamar | Lecturas de datos | Privilegio especial |
|---|---|---|---|
| crear-campana-marketing | Perfil propio activo owner/admin/marketing | Perfil mediante sesión RLS; contenido aportado por quien llama | Ninguno |
| generar-kit-marketing | Perfil propio activo owner/admin/marketing | Perfil mediante sesión RLS; contenido aportado por quien llama | Ninguno |
| revisar-marketing | Perfil propio activo owner/admin/marketing | Perfil mediante sesión RLS; contenido aportado por quien llama | Ninguno |
| analizar-campana-marketing | Perfil propio activo owner/admin/marketing | Perfil mediante sesión RLS; contenido aportado por quien llama | Ninguno |
| evaluar-tarea | Perfil activo y acceso a la tarea según RLS, organización y asignación | Tarea y evidencias con cliente del usuario | Ninguno; escritura y rescate también sujetos a RLS |
| analizar-cierre-turno | Dirección autorizada o quien creó el cierre, con alcance de negocio/sucursal | Cierre, sucursal y negocio mediante sesión RLS | Solo INSERT del resultado generado, después de volver a autorizar el cierre; la tabla de resultados no permite INSERT al usuario |
| analizar-patrones-cierres | Owner/admin activos | Cierres visibles mediante RLS y validación de sucursal cuando se solicita | Solo INSERT del resultado para una sucursal explícita revalidada; nunca un agregado global |

Todas las funciones de esta tabla validan el usuario con Auth y rechazan sesiones anónimas. Los permisos proceden del perfil actual en la base; no de user_metadata ni del body. Se despliegan con verify_jwt=true además de la validación interna.

Una solicitud sin acceso no debe leer el cuerpo, consultar recursos con privilegio, consumir OpenAI, ni ejecutar rescates sobre IDs ajenos. CORS abierto no concede autorización.

El detector de patrones limita la consulta a 500 cierres y periodos entre 1 y 90 días. Informa cuando analiza una muestra. Un resultado sin persistencia devuelve guardado=false; el cliente lo rechaza antes de crear tareas automáticas. Los totales y alcance proceden de los datos consultados, no de cantidades inventadas por el modelo.

## Comprobación

Las pruebas dinámicas ejecutan los handlers reales con Auth, base de datos y OpenAI simulados. Incluyen ausencia de sesión, token inválido, usuario anónimo, perfil inactivo, error de consulta, rol no permitido, organización/sucursal/ID ajenos, rescate no autorizado, persistencia limitada y casos permitidos.

La comprobación HTTP de producción sin sesión y con token inválido no consume IA. Las pruebas positivas con personas y organizaciones reales siguen siendo necesarias antes de certificar aislamiento completo. No se crearon usuarios de prueba ni se cambiaron datos de negocio para esta publicación.

## Lector de reportes

SheetJS se fija a la distribución oficial 0.20.3 con integridad SHA512 en el lockfile. El lector admite XLSX, XLS y CSV hasta 10 MB; comprueba tamaño antes y después de leer. CSV conserva texto y códigos con ceros iniciales; decodifica UTF8, UTF16 con BOM o Windows1252. XLS carga las tablas de códigos al utilizarse. El límite de tamaño no equivale a aislamiento completo frente a archivos comprimidos maliciosos.

## Pendientes

- Cuotas y topes persistentes de costo por organización, idempotencia y límites de reintentos.
- Pruebas integrales con sesiones reales de cada rol y de otra organización, incluidas RPC y Storage.
- Revisión completa de políticas, escaneo del historial de secretos y restauración de respaldos.
- Evaluar reemplazar los dos escritores privilegiados por operaciones de base de datos estrictamente acotadas, sin abrir las tablas de resultados a clientes generales.

No se cambiaron políticas, permisos, saldos ni esquemas en esta publicación.
