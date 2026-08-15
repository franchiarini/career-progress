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
          const tipoHtml =
            materia.tipo !== 'obligatoria'
              ? `<span class="materia-tipo ${materia.tipo}">${materia.tipo}</span>`
              : '';

          return `
            <article class="materia-card ${materia.tipo === 'electiva' ? 'electiva' : ''}">
              <h3>${materia.nombre}</h3>
              <p class="materia-anio">Año ${materia.anio}</p>
              ${tipoHtml}
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
}

cargarMaterias()
  .then((materias) => {
    renderizarMaterias(materias);
    console.log(`Materias cargadas: ${materias.length}`);
  })
  .catch((error) => {
    console.error('No se pudieron cargar las materias.', error);
  });
