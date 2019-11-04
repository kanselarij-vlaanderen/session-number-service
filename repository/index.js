import mu from 'mu';
const targetGraph = "http://mu.semte.ch/graphs/organizations/kanselarij";

const getAllSessions = async () => {
	const firstDayOfTheYear = new Date(new Date().getFullYear(), 0, 1);
	const query = `
  PREFIX besluit: <http://data.vlaanderen.be/ns/besluit#>
	PREFIX mu: <http://mu.semte.ch/vocabularies/core/>

  SELECT ?session WHERE {
    GRAPH <${targetGraph}> 
    {
      ?session a besluit:Zitting ;
      mu:uuid ?uuid ;
      besluit:geplandeStart ?plannedstart .
      FILTER(str(?plannedstart) > "${firstDayOfTheYear.toISOString()}")
    }
  }
  ORDER BY ASC(?plannedstart)
  LIMIT 366`;
	const data = await mu.query(query);
	return parseSparqlResults(data);
};

const getActiveAgendas = async (date, sort, sign) => {
	const dateToFilter = setDateTimeOnZero(date);
	const query = `
  PREFIX besluit: <http://data.vlaanderen.be/ns/besluit#>
	PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
	PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
  
  SELECT ?meeting ?meeting_id ?plannedstart ?agendaName ?agenda_id ?creationDate WHERE {
    GRAPH <${targetGraph}> 
    {
			?meeting a besluit:Zitting ;
			?meeting ext:finaleZittingVersie "false"^^<http://mu.semte.ch/vocabularies/typed-literals/boolean> ;
      mu:uuid ?meeting_id ;
			besluit:geplandeStart ?plannedstart .
			?agendas besluit:isAangemaaktVoor ?meeting ;
			mu:uuid ?agenda_id ;
			ext:agendaNaam ?agendaName .
			FILTER(str(?plannedstart) ${sign} "${dateToFilter.toISOString()}")
			OPTIONAL {
			  ?agendas ext:aangemaaktOp ?creationDate .
			}
    }
  }
  ORDER BY ${sort}(?plannedstart)`

	let data = await mu.query(query);
	return parseSparqlResults(data);
};

const updateSessionNumbers = async (sessions) => {
	let toDelete = [];
	let insertString = "";

	sessions.forEach(obj => {
		toDelete.push(`<${obj.session}>`);
		insertString = `${insertString}
    <${obj.session}> adms:identifier """${obj.number}"""^^xsd:decimal .
    `
	})

	const deleteString = toDelete.join();

	const query = `
  PREFIX adms: <http://www.w3.org/ns/adms#>
  
  DELETE WHERE { 
    GRAPH <${targetGraph}> { 
      ?target adms:identifier ?o .
      FILTER(?target IN (${deleteString}))
    } 
  };

  INSERT DATA { 
    GRAPH <${targetGraph}> { 
      ${insertString}
    } 
  }
  `
	return mu.update(query);
}

const parseSparqlResults = (data) => {
	const vars = data.head.vars;
	return data.results.bindings.map(binding => {
		let obj = {};

		vars.forEach(varKey => {
			if (binding[varKey]) {
				obj[varKey] = binding[varKey].value;
			} else {
				obj[varKey] = null;
			}
		});
		return obj;
	})
};

const setDateTimeOnZero = (date) => {
	date.setHours(0);
  date.setMinutes(0);
  date.setSeconds(0);
	date.setMilliseconds(0);
	return date;
}

module.exports = {
	getAllSessions,
	getActiveAgendas,
	updateSessionNumbers
};
