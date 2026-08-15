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

function actualizarEstadoMateria(idMateria, nuevoEstado) {
  if (!estadosAcademicos[idMateria]) {
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
    inicializarEstados(materias);
    renderizarMaterias(materias);
    console.log(`Materias cargadas: ${materias.length}`);
  })
  .catch((error) => {
    console.error('No se pudieron cargar las materias.', error);
  });
