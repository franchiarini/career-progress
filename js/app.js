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

cargarMaterias()
  .then((materias) => {
    console.log(`Materias cargadas: ${materias.length}`);
  })
  .catch((error) => {
    console.error('No se pudieron cargar las materias.', error);
  });
