import mu from 'mu';
import { ok } from 'assert';
import moment from 'moment';

const cors = require('cors');
const app = mu.app;
const bodyParser = require('body-parser');
const repository = require('./repository');

app.use(cors());
app.use(bodyParser.json({ type: 'application/*+json' }));

app.get('/assignNewSessionNumbers', async function(req, res) {
  let sessions = await repository.getAllSessions();

  for (let i = 0; i < sessions.length; i++) {
    sessions[i].number = i + 1;
  }

  const updatedDate = await repository.updateSessionNumbers(sessions);
  res.send({
    status: ok,
    statusCode: 200,
    body: {
      sessions: sessions,
      updateMessage: updatedDate,
    },
  });
});

app.get('/activeAgendas', async function(req, res) {
  try {
    const date = new Date(req.query.date);
    const meetings = await repository.getActiveAgendas(date, 'ASC', '>');
    if (meetings) {
      res.send({
        status: ok,
        statusCode: 200,
        body: { agendas: meetings },
      });
    } else {
      res.send({
        status: ok,
        statusCode: 400,
        body: { message: 'No active agendas found.' },
      });
    }
  } catch (e) {
    res.send({
      status: ok,
      statusCode: 403,
      body: {
        message: 'Not a correct date parameter.',
      },
    });
  }
});

mu.app.use(mu.errorHandler);
