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
let materiasDelPlan = [];

function obtenerTextoEstado(estado) {
  switch (estado) {
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

  return `No podés cambiar ${materia.nombre} a ${obtenerTextoEstado(nuevoEstado)} porque ${listaFormateada} necesita${nombres.length > 1 ? 'n' : ''} tenerla ${nuevoEstado === 'regular' ? 'regular o aprobada' : 'aprobada'}.`;
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
    const estadoValido = ['no-cursada', 'regular', 'aprobada'].includes(estadoGuardado)
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

  if (nuevoEstado === 'regular') {
    const faltantes = correlativas.filter((correlativaId) => {
      const estadoCorrelativa = estadosAcademicos[correlativaId];
      return !['regular', 'aprobada'].includes(estadoCorrelativa);
    });

    if (faltantes.length) {
      return {
        valido: false,
        motivo: construirMensajeCorrelativas(materia, nuevoEstado, faltantes),
        faltantes
      };
    }
  }

  if (nuevoEstado === 'aprobada') {
    const faltantes = correlativas.filter((correlativaId) => {
      return estadosAcademicos[correlativaId] !== 'aprobada';
    });

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
  if (!estadosAcademicos[idMateria]) {
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
  tarjeta.classList.remove('no-cursada', 'regular', 'aprobada');
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
}

function renderizarMaterias(materias) {
  const contenedor = document.getElementById('malla-cursos');

  if (!contenedor) {
    return;
  }

  const materiasPorAnio = {};

  for (let anio = 1; anio <= 5; anio += 1) {
    materiasPorAnio[anio] = [];
  }

  materias.forEach((materia) => {
    if (materia.anio >= 1 && materia.anio <= 5) {
      materiasPorAnio[materia.anio].push(materia);
    }
  });

  const seccionesHTML = Object.entries(materiasPorAnio)
    .map(([anio, materiasDelAnio]) => {
      const tarjetasHTML = materiasDelAnio
        .map((materia) => {
          const estadoActual = estadosAcademicos[materia.id] || 'no-cursada';
          const tipoHtml =
            materia.tipo !== 'obligatoria'
              ? `<span class="materia-tipo ${materia.tipo}">${materia.tipo}</span>`
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
                <button class="estado-btn ${estadoActual === 'regular' ? 'active' : ''}" type="button" data-id="${materia.id}" data-estado="regular" aria-pressed="${estadoActual === 'regular'}">Regular</button>
                <button class="estado-btn ${estadoActual === 'aprobada' ? 'active' : ''}" type="button" data-id="${materia.id}" data-estado="aprobada" aria-pressed="${estadoActual === 'aprobada'}">Aprobada</button>
              </div>

              <div class="estado-actual">
                ${obtenerTextoEstado(estadoActual)}
              </div>
            </article>
          `;
        })
        .join('');

      return `
        <section class="anio-seccion" aria-label="${anio}° Año">
          <h2>${anio}° Año</h2>
          <div class="materias-grid">
            ${tarjetasHTML}
          </div>
        </section>
      `;
    })
    .join('');

  contenedor.innerHTML = seccionesHTML;

  contenedor.querySelectorAll('.estado-btn').forEach((boton) => {
    boton.addEventListener('click', (event) => {
      const idMateria = event.currentTarget.dataset.id;
      const nuevoEstado = event.currentTarget.dataset.estado;
      actualizarEstadoMateria(idMateria, nuevoEstado);
    });
  });
}

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
