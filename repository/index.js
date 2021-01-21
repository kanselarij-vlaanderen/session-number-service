import mu from 'mu';
const targetGraph = "http://mu.semte.ch/graphs/organizations/kanselarij";
const publicGraph = "http://mu.semte.ch/graphs/public";
const annexKind = 'http://kanselarij.vo.data.gift/id/concept/ministerraad-type-codes/d36138a9-07f0-4df6-bbf0-abd51a24e4ce';

const getAllSessions = async () => {
	const firstDayOfTheYear = new Date(new Date().getFullYear(), 0, 1);
	const query = `
  PREFIX besluit: <http://data.vlaanderen.be/ns/besluit#>
	PREFIX mu: <http://mu.semte.ch/vocabularies/core/>

  SELECT ?session WHERE {
    GRAPH <${targetGraph}> 
    {
      ?session a besluit:Vergaderactiviteit ;
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

const getClosestMeeting = async (date) => {
  const query = `
  PREFIX besluit: <http://data.vlaanderen.be/ns/besluit#>
	PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
	PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
  PREFIX besluitvorming: <http://data.vlaanderen.be/ns/besluitvorming#>
  PREFIX dct: <http://purl.org/dc/terms/>
  PREFIX skos: <http://www.w3.org/2004/02/skos/core#>

  SELECT ?session ?meeting_id ?plannedstart ?agenda_id ?creationDate WHERE {
    GRAPH <${targetGraph}>
    {
      ?session a besluit:Vergaderactiviteit ;
                        mu:uuid ?meeting_id ;
                        dct:type ?meetingKind ;
			besluit:geplandeStart ?plannedstart .
      ?agendas besluitvorming:isAgendaVoor ?session ;
			mu:uuid ?agenda_id .
      OPTIONAL {
        ?agendas dct:created ?creationDate .
      }
    }
    FILTER(str(?plannedstart) < "${date.toISOString()}")
    GRAPH <${publicGraph}>
    {
        ?meetingKind a ext:MinisterraadType .
        FILTER NOT EXISTS {
            ?meetingKind skos:broader+ ?broader .
        }
    }
  }
  ORDER BY DESC(?plannedstart) DESC(?creationDate)
  LIMIT 1`;

  const data = await mu.query(query);
  return parseSparqlResults(data);
};

const getActiveAgendas = async (date) => {
	const dateToFilter = setDateTimeOnZero(date);
	const query = `
  PREFIX besluit: <http://data.vlaanderen.be/ns/besluit#>
	PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
	PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
  PREFIX besluitvorming: <http://data.vlaanderen.be/ns/besluitvorming#>
  PREFIX dct: <http://purl.org/dc/terms/>

  SELECT ?meeting ?meeting_id ?plannedstart ?agenda_id ?creationDate WHERE {
    GRAPH <${targetGraph}> 
    {
			?meeting a besluit:Vergaderactiviteit ;
			ext:finaleZittingVersie "false"^^<http://mu.semte.ch/vocabularies/typed-literals/boolean> ;
      mu:uuid ?meeting_id ;
			besluit:geplandeStart ?plannedstart .
			?agendas besluitvorming:isAgendaVoor ?meeting ;
			mu:uuid ?agenda_id .
			FILTER(str(?plannedstart) > "${dateToFilter.toISOString()}")
			OPTIONAL {
			  ?agendas dct:created ?creationDate .
			}
    }
  }
  ORDER BY ASC (?plannedstart)`

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
	updateSessionNumbers,
	getClosestMeeting
};
