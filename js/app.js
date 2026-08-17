async function cargarMaterias() {
  try {
    const response = await fetch('./data/materias.json');

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
    }

    const materias = await response.json();
    return materias;
  } catch (error) {
    console.error('Error al cargar materias:', error);
    throw error;
  }
}

const estadosAcademicos = {};
const STORAGE_KEY = 'career-progress-estados';
const THEME_STORAGE_KEY = 'career-progress-theme';
let materiasDelPlan = [];
const estadoSeccionesAnios = {};

function esPantallaMovil() {
  return window.matchMedia('(max-width: 640px)').matches;
}

function obtenerMateriasPorAnio(materias) {
  const materiasPorAnio = {};

  for (let anio = 1; anio <= 5; anio += 1) {
    materiasPorAnio[anio] = [];
  }

  materias.forEach((materia) => {
    if (materia.anio >= 1 && materia.anio <= 5) {
      materiasPorAnio[materia.anio].push(materia);
    }
  });

  return materiasPorAnio;
}

function obtenerEstadoSeccionInicial(anio, materiasDelAnio) {
  if (estadoSeccionesAnios[anio] !== undefined) {
    return estadoSeccionesAnios[anio];
  }

  if (esPantallaMovil()) {
    const tieneEnCurso = materiasDelAnio.some((materia) => (estadosAcademicos[materia.id] || 'no-cursada') === 'en-curso');
    return tieneEnCurso;
  }

  return true;
}

function obtenerResumenAnio(materiasDelAnio) {
  const aprobadas = materiasDelAnio.filter((materia) => (estadosAcademicos[materia.id] || 'no-cursada') === 'aprobada').length;
  return `${aprobadas} / ${materiasDelAnio.length} aprobadas`;
}

function aplicarTema(tema) {
  const temaNormalizado = tema === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = temaNormalizado;

  try {
    localStorage.setItem(THEME_STORAGE_KEY, temaNormalizado);
  } catch (error) {
    console.error('Error al guardar el tema:', error);
  }

  const toggle = document.getElementById('theme-toggle');

  if (!toggle) {
    return;
  }

  toggle.textContent = temaNormalizado === 'dark' ? '☀️ Claro' : '🌙 Oscuro';
  toggle.setAttribute('aria-label', temaNormalizado === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro');
}

function inicializarTema() {
  try {
    const temaGuardado = localStorage.getItem(THEME_STORAGE_KEY);
    const tema = temaGuardado === 'dark' || temaGuardado === 'light' ? temaGuardado : 'light';
    aplicarTema(tema);
  } catch (error) {
    console.error('Error al leer el tema guardado:', error);
    aplicarTema('light');
  }

  const toggle = document.getElementById('theme-toggle');

  if (!toggle) {
    return;
  }

  toggle.addEventListener('click', () => {
    const temaActual = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    aplicarTema(temaActual === 'dark' ? 'light' : 'dark');
  });
}

function obtenerTextoEstado(estado) {
  switch (estado) {
    case 'en-curso':
      return 'En curso';
    case 'regular':
      return 'Regular';
    case 'aprobada':
      return 'Aprobada';
    case 'no-cursada':
    default:
      return 'No cursada';
  }
}

function cargarEstadosGuardados() {
  try {
    const guardado = localStorage.getItem(STORAGE_KEY);
    return guardado ? JSON.parse(guardado) : {};
  } catch (error) {
    console.error('Error al leer estados guardados:', error);
    return {};
  }
}

function guardarEstadosEnLocalStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(estadosAcademicos));
  } catch (error) {
    console.error('Error al guardar estados:', error);
  }
}

function obtenerMateriaPorId(materiaId) {
  return materiasDelPlan.find((materia) => materia.id === materiaId) || null;
}

function obtenerMateriasDependientes(materiaId) {
  return materiasDelPlan.filter((materia) => {
    const correlativas = Array.isArray(materia.correlativas) ? materia.correlativas : [];
    return correlativas.includes(materiaId);
  });
}

function obtenerCorrelativas(materia) {
  return Array.isArray(materia?.correlativas) ? materia.correlativas : [];
}

function obtenerCorrelativasFaltantes(materiaId, requisito) {
  const materia = obtenerMateriaPorId(materiaId);

  if (!materia) {
    return [];
  }

  const correlativas = obtenerCorrelativas(materia);

  if (!correlativas.length) {
    return [];
  }

  return correlativas.filter((correlativaId) => {
    const estadoCorrelativa = estadosAcademicos[correlativaId];

    if (requisito === 'cursar') {
      return !['regular', 'aprobada'].includes(estadoCorrelativa);
    }

    if (requisito === 'aprobar') {
      return estadoCorrelativa !== 'aprobada';
    }

    return false;
  });
}

function puedeCursarMateria(materiaId) {
  const materia = obtenerMateriaPorId(materiaId);

  if (!materia) {
    return { puedeCursar: false, faltantes: [] };
  }

  const faltantes = obtenerCorrelativasFaltantes(materiaId, 'cursar');
  return { puedeCursar: faltantes.length === 0, faltantes };
}

function puedeAprobarMateria(materiaId) {
  const materia = obtenerMateriaPorId(materiaId);

  if (!materia) {
    return { puedeAprobar: false, faltantes: [] };
  }

  const faltantes = obtenerCorrelativasFaltantes(materiaId, 'aprobar');
  return { puedeAprobar: faltantes.length === 0, faltantes };
}

function formatearListaNombres(lista) {
  if (!lista.length) {
    return '';
  }

  if (lista.length === 1) {
    return lista[0];
  }

  if (lista.length === 2) {
    return `${lista[0]} y ${lista[1]}`;
  }

  return `${lista.slice(0, -1).join(', ')}, y ${lista[lista.length - 1]}`;
}

function construirMensajeCorrelativas(materia, nuevoEstado, faltantes) {
  const nombres = faltantes
    .map((id) => obtenerMateriaPorId(id)?.nombre || id)
    .filter(Boolean);

  if (!nombres.length) {
    return '';
  }

  const listaFormateada = formatearListaNombres(nombres);

  if (nuevoEstado === 'aprobada') {
    return faltantes.length === 1
      ? `Para aprobar ${materia.nombre} necesitás tener aprobada: ${listaFormateada}.`
      : `Para aprobar ${materia.nombre} necesitás tener aprobadas:\n${listaFormateada}.`;
  }

  if (nuevoEstado === 'en-curso') {
    return faltantes.length === 1
      ? `Para cursar ${materia.nombre} necesitás tener regular o aprobada: ${listaFormateada}.`
      : `Para cursar ${materia.nombre} necesitás tener regular o aprobada:\n${listaFormateada}.`;
  }

  return faltantes.length === 1
    ? `Para regularizar ${materia.nombre} necesitás tener regular o aprobada: ${listaFormateada}.`
    : `Para regularizar ${materia.nombre} necesitás tener regular o aprobada:\n${listaFormateada}.`;
}

function construirMensajeDependencias(materia, nuevoEstado, dependientes) {
  const nombres = dependientes.map((dependiente) => dependiente.nombre);
  const listaFormateada = formatearListaNombres(nombres);

  if (nuevoEstado === 'no-cursada') {
    return `No podés cambiar ${materia.nombre} a No cursada porque invalidaría:\n${listaFormateada}.`;
  }

  const requisitoTexto = nuevoEstado === 'regular' || nuevoEstado === 'en-curso'
    ? 'regular o aprobada'
    : 'aprobada';

  return `No podés cambiar ${materia.nombre} a ${obtenerTextoEstado(nuevoEstado)} porque ${listaFormateada} necesita${nombres.length > 1 ? 'n' : ''} tenerla ${requisitoTexto}.`;
}

function obtenerDisponibilidadMateria(materiaId) {
  const materia = obtenerMateriaPorId(materiaId);

  if (!materia) {
    return { clase: '', titulo: '', detalle: '' };
  }

  const estadoActual = estadosAcademicos[materiaId] || 'no-cursada';
  const correlativas = obtenerCorrelativas(materia);
  const faltantesParaCursar = obtenerCorrelativasFaltantes(materiaId, 'cursar');
  const faltantesParaAprobar = obtenerCorrelativasFaltantes(materiaId, 'aprobar');
  const nombresFaltantesParaCursar = faltantesParaCursar
    .map((id) => obtenerMateriaPorId(id)?.nombre || id)
    .filter(Boolean);
  const nombresFaltantesParaAprobar = faltantesParaAprobar
    .map((id) => obtenerMateriaPorId(id)?.nombre || id)
    .filter(Boolean);

  if (estadoActual === 'aprobada') {
    return { clase: '', titulo: '', detalle: '' };
  }

  if (estadoActual === 'regular') {
    if (!faltantesParaAprobar.length) {
      return { clase: 'habilitada', titulo: '✓ Habilitada para aprobar', detalle: '' };
    }

    return {
      clase: 'pendiente',
      titulo: 'Regular',
      detalle: `Para aprobar falta: ${formatearListaNombres(nombresFaltantesParaAprobar)}`
    };
  }

  if (estadoActual === 'en-curso') {
    if (!correlativas.length) {
      return { clase: 'habilitada', titulo: '✓ Sin correlativas pendientes', detalle: '' };
    }

    if (faltantesParaCursar.length) {
      return {
        clase: 'bloqueada',
        titulo: '🔒 Bloqueada para cursar',
        detalle: `Falta regularizar: ${formatearListaNombres(nombresFaltantesParaCursar)}`
      };
    }

    if (faltantesParaAprobar.length) {
      return {
        clase: 'habilitada',
        titulo: '✓ Habilitada para cursar',
        detalle: `Para aprobar falta: ${formatearListaNombres(nombresFaltantesParaAprobar)}`
      };
    }

    return { clase: 'habilitada', titulo: '✓ Habilitada para cursar y aprobar', detalle: '' };
  }

  if (!correlativas.length) {
    return { clase: 'habilitada', titulo: '✓ Sin correlativas pendientes', detalle: '' };
  }

  if (faltantesParaCursar.length) {
    return {
      clase: 'bloqueada',
      titulo: '🔒 Bloqueada para cursar',
      detalle: `Falta regularizar: ${formatearListaNombres(nombresFaltantesParaCursar)}`
    };
  }

  if (faltantesParaAprobar.length) {
    return {
      clase: 'habilitada',
      titulo: '✓ Habilitada para cursar',
      detalle: `Para aprobar falta: ${formatearListaNombres(nombresFaltantesParaAprobar)}`
    };
  }

  return { clase: 'habilitada', titulo: '✓ Habilitada para cursar y aprobar', detalle: '' };
}

function actualizarDisponibilidadEnTarjetas() {
  const tarjetas = document.querySelectorAll('.materia-card');

  tarjetas.forEach((tarjeta) => {
    const idMateria = tarjeta.dataset.materiaId;
    const disponibilidad = obtenerDisponibilidadMateria(idMateria);
    const indicador = tarjeta.querySelector('.disponibilidad-indicador');

    if (!indicador) {
      return;
    }

    indicador.className = `disponibilidad-indicador ${disponibilidad.clase || ''}`.trim();
    indicador.innerHTML = '';

    if (disponibilidad.titulo) {
      const titulo = document.createElement('span');
      titulo.className = 'disponibilidad-titulo';
      titulo.textContent = disponibilidad.titulo;
      indicador.appendChild(titulo);
    }

    if (disponibilidad.detalle) {
      const detalle = document.createElement('span');
      detalle.className = 'disponibilidad-detalle';
      detalle.textContent = disponibilidad.detalle;
      indicador.appendChild(detalle);
    }
  });
}

function actualizarDashboard() {
  const contenedor = document.getElementById('dashboard-container');

  if (!contenedor) {
    return;
  }

  const totalMaterias = materiasDelPlan.length;
  const aprobadas = Object.values(estadosAcademicos).filter((estado) => estado === 'aprobada').length;
  const regulares = Object.values(estadosAcademicos).filter((estado) => estado === 'regular').length;
  const enCurso = Object.values(estadosAcademicos).filter((estado) => estado === 'en-curso').length;
  const noCursadas = Object.values(estadosAcademicos).filter((estado) => estado === 'no-cursada').length;
  const porcentaje = totalMaterias ? Math.round((aprobadas / totalMaterias) * 100) : 0;

  contenedor.innerHTML = `
    <section class="dashboard" aria-label="Progreso académico">
      <div class="dashboard-header">
        <h2>Progreso de la carrera</h2>
        <span class="dashboard-porcentaje">${porcentaje}%</span>
      </div>

      <div class="progress-bar" aria-hidden="true">
        <span class="progress-fill" style="width: ${porcentaje}%"></span>
      </div>

      <div class="dashboard-stats">
        <div class="stat-item"><span>Aprobadas:</span> <strong>${aprobadas}</strong></div>
        <div class="stat-item"><span>Regulares:</span> <strong>${regulares}</strong></div>
        <div class="stat-item"><span>En curso:</span> <strong>${enCurso}</strong></div>
        <div class="stat-item"><span>No cursadas:</span> <strong>${noCursadas}</strong></div>
        <div class="stat-item"><span>Total:</span> <strong>${totalMaterias}</strong></div>
      </div>
    </section>
  `;
}

function mostrarMensajeValidacion(mensaje) {
  let contenedor = document.getElementById('mensaje-validacion');

  if (!contenedor) {
    contenedor = document.createElement('div');
    contenedor.id = 'mensaje-validacion';
    document.body.prepend(contenedor);
  }

  contenedor.textContent = mensaje;
  contenedor.classList.add('visible');

  clearTimeout(mostrarMensajeValidacion.timeoutId);
  mostrarMensajeValidacion.timeoutId = setTimeout(() => {
    contenedor.classList.remove('visible');
  }, 4500);
}

function inicializarEstados(materias) {
  const estadosGuardados = cargarEstadosGuardados();

  materias.forEach((materia) => {
    const estadoGuardado = estadosGuardados[materia.id];
    const estadoValido = ['no-cursada', 'en-curso', 'regular', 'aprobada'].includes(estadoGuardado)
      ? estadoGuardado
      : 'no-cursada';

    estadosAcademicos[materia.id] = estadoValido;
  });
}

function puedeCambiarEstado(materiaId, nuevoEstado) {
  const materia = obtenerMateriaPorId(materiaId);

  if (!materia) {
    return { valido: false, motivo: 'La materia seleccionada no existe.', faltantes: [] };
  }

  if (nuevoEstado === estadosAcademicos[materiaId]) {
    return { valido: true, motivo: '', faltantes: [] };
  }

  const correlativas = Array.isArray(materia.correlativas) ? materia.correlativas : [];

  if (nuevoEstado === 'regular' || nuevoEstado === 'en-curso') {
    const faltantes = obtenerCorrelativasFaltantes(materiaId, 'cursar');

    if (faltantes.length) {
      return {
        valido: false,
        motivo: construirMensajeCorrelativas(materia, nuevoEstado, faltantes),
        faltantes
      };
    }
  }

  if (nuevoEstado === 'aprobada') {
    const faltantes = obtenerCorrelativasFaltantes(materiaId, 'aprobar');

    if (faltantes.length) {
      return {
        valido: false,
        motivo: construirMensajeCorrelativas(materia, nuevoEstado, faltantes),
        faltantes
      };
    }
  }

  const materiasDependientes = obtenerMateriasDependientes(materiaId);

  const conflictos = materiasDependientes.filter((materiaDependiente) => {
    const estadoDependiente = estadosAcademicos[materiaDependiente.id];

    if (estadoDependiente === 'regular') {
      return !['regular', 'aprobada'].includes(nuevoEstado);
    }

    if (estadoDependiente === 'aprobada') {
      return nuevoEstado !== 'aprobada';
    }

    return false;
  });

  if (conflictos.length) {
    return {
      valido: false,
      motivo: construirMensajeDependencias(materia, nuevoEstado, conflictos),
      faltantes: conflictos.map((dependiente) => dependiente.id)
    };
  }

  return { valido: true, motivo: '', faltantes: [] };
}

function actualizarEstadoMateria(idMateria, nuevoEstado) {
  if (!estadosAcademicos[idMateria] && idMateria !== undefined) {
    return;
  }

  const validacion = puedeCambiarEstado(idMateria, nuevoEstado);

  if (!validacion.valido) {
    mostrarMensajeValidacion(validacion.motivo);
    return;
  }

  estadosAcademicos[idMateria] = nuevoEstado;
  guardarEstadosEnLocalStorage();

  const tarjeta = document.querySelector(`[data-materia-id="${idMateria}"]`);

  if (!tarjeta) {
    return;
  }

  tarjeta.dataset.estado = nuevoEstado;
  tarjeta.classList.remove('no-cursada', 'en-curso', 'regular', 'aprobada');
  tarjeta.classList.add(nuevoEstado);

  const estadoActual = tarjeta.querySelector('.estado-actual');

  if (estadoActual) {
    estadoActual.textContent = obtenerTextoEstado(nuevoEstado);
  }

  const botones = tarjeta.querySelectorAll('.estado-btn');

  botones.forEach((boton) => {
    const esActivo = boton.dataset.estado === nuevoEstado;
    boton.classList.toggle('active', esActivo);
    boton.setAttribute('aria-pressed', String(esActivo));
  });

  actualizarDisponibilidadEnTarjetas();
  actualizarDashboard();
}

function alternarAnio(boton) {
  const seccion = boton.closest('.anio-seccion');

  if (!seccion) {
    return;
  }

  const anio = Number(seccion.dataset.anio);
  const contenido = seccion.querySelector('.materias-grid');
  const estabaAbierta = boton.getAttribute('aria-expanded') === 'true';
  const vaAbierta = !estabaAbierta;
  const icono = boton.querySelector('.anio-toggle-icon');

  if (!contenido || !icono) {
    return;
  }

  estadoSeccionesAnios[anio] = vaAbierta;
  boton.setAttribute('aria-expanded', String(vaAbierta));
  icono.textContent = vaAbierta ? '▼' : '▶';
  contenido.hidden = !vaAbierta;
}

function renderizarMaterias(materias) {
  const contenedor = document.getElementById('malla-cursos');

  if (!contenedor) {
    return;
  }

  const materiasPorAnio = obtenerMateriasPorAnio(materias);

  const seccionesHTML = Object.entries(materiasPorAnio)
    .map(([anio, materiasDelAnio]) => {
      const anioNumero = Number(anio);
      const estaAbierta = obtenerEstadoSeccionInicial(anioNumero, materiasDelAnio);
      const tarjetasHTML = materiasDelAnio
        .map((materia) => {
          const estadoActual = estadosAcademicos[materia.id] || 'no-cursada';
          const tipoHtml =
            materia.tipo !== 'obligatoria'
              ? `<span class="materia-tipo ${materia.tipo}">${materia.tipo}</span>`
              : '';
          const disponibilidad = obtenerDisponibilidadMateria(materia.id);
          const disponibilidadHtml = disponibilidad.titulo || disponibilidad.detalle
            ? `
              <div class="disponibilidad-indicador ${disponibilidad.clase || ''}">
                ${disponibilidad.titulo ? `<span class="disponibilidad-titulo">${disponibilidad.titulo}</span>` : ''}
                ${disponibilidad.detalle ? `<span class="disponibilidad-detalle">${disponibilidad.detalle}</span>` : ''}
              </div>
            `
            : '';

          return `
            <article
              class="materia-card ${materia.tipo === 'electiva' ? 'electiva' : ''} ${estadoActual}"
              data-materia-id="${materia.id}"
              data-estado="${estadoActual}"
            >
              <h3>${materia.nombre}</h3>
              <p class="materia-anio">Año ${materia.anio}</p>
              ${tipoHtml}

              <div class="selector-estado" aria-label="Estado académico de ${materia.nombre}">
                <button class="estado-btn ${estadoActual === 'no-cursada' ? 'active' : ''}" type="button" data-id="${materia.id}" data-estado="no-cursada" aria-pressed="${estadoActual === 'no-cursada'}">No cursada</button>
                <button class="estado-btn ${estadoActual === 'en-curso' ? 'active' : ''}" type="button" data-id="${materia.id}" data-estado="en-curso" aria-pressed="${estadoActual === 'en-curso'}">En curso</button>
                <button class="estado-btn ${estadoActual === 'regular' ? 'active' : ''}" type="button" data-id="${materia.id}" data-estado="regular" aria-pressed="${estadoActual === 'regular'}">Regular</button>
                <button class="estado-btn ${estadoActual === 'aprobada' ? 'active' : ''}" type="button" data-id="${materia.id}" data-estado="aprobada" aria-pressed="${estadoActual === 'aprobada'}">Aprobada</button>
              </div>

              <div class="estado-actual">
                ${obtenerTextoEstado(estadoActual)}
              </div>
              ${disponibilidadHtml}
            </article>
          `;
        })
        .join('');

      return `
        <section class="anio-seccion" data-anio="${anioNumero}" aria-label="${anioNumero}° Año">
          <button
            class="anio-header"
            type="button"
            aria-expanded="${estaAbierta}"
            aria-controls="anio-${anioNumero}-contenido"
          >
            <span class="anio-toggle-icon">${estaAbierta ? '▼' : '▶'}</span>
            <span class="anio-titulo">${anioNumero}° Año</span>
            <span class="anio-resumen">${obtenerResumenAnio(materiasDelAnio)}</span>
          </button>

          <div id="anio-${anioNumero}-contenido" class="materias-grid" ${estaAbierta ? '' : 'hidden'}>
            ${tarjetasHTML}
          </div>
        </section>
      `;
    })
    .join('');

  contenedor.innerHTML = seccionesHTML;
  actualizarDisponibilidadEnTarjetas();
  actualizarDashboard();

  contenedor.addEventListener('click', (event) => {
    const boton = event.target.closest('.anio-header');

    if (!boton) {
      return;
    }

    alternarAnio(boton);
  });

  contenedor.querySelectorAll('.estado-btn').forEach((boton) => {
    boton.addEventListener('click', (event) => {
      const idMateria = event.currentTarget.dataset.id;
      const nuevoEstado = event.currentTarget.dataset.estado;
      actualizarEstadoMateria(idMateria, nuevoEstado);
    });
  });
}

inicializarTema();

cargarMaterias()
  .then((materias) => {
    materiasDelPlan = materias;
    inicializarEstados(materias);
    renderizarMaterias(materias);
    console.log(`Materias cargadas: ${materias.length}`);
  })
  .catch((error) => {
    console.error('No se pudieron cargar las materias.', error);
  });
