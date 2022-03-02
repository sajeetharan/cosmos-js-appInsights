const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
const appInsights = require('applicationinsights');
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

const port = process.env.PORT || 3000;
const server = app.listen(port);
const config = require("./config");

const dbContext = require("./databaseContext");
const CosmosClient = require("@azure/cosmos").CosmosClient;
const { query } = require("express");
const { partitionKey } = require("./config");

app.use(cors());
const {applicationInsightsKey} = config;

appInsights.setup(applicationInsightsKey).setAutoDependencyCorrelation(true)
  .setAutoCollectRequests(true)
  .setAutoCollectPerformance(true, true)
  .setAutoCollectExceptions(true)
  .setAutoCollectDependencies(true)
  .setAutoCollectConsole(true)
  .setUseDiskRetryCaching(true)
  .setSendLiveMetrics(true)
  .setDistributedTracingMode(appInsights.DistributedTracingModes.AI)
  .start();

app.use(function (req, res, next) {
  res.setHeader("Access-Control-Allow-Origin", "http://localhost:3001");
  res.setHeader("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Credentials", true);
  next();
});

let appInsightsClient = appInsights.defaultClient;

const createContainer = (containerId, dataReceived) => {
  const { endpoint, key, databaseId } = config;

  const client = new CosmosClient({ endpoint, key });

  const database = client.database(databaseId);
  const container = database.container(containerId);

  // Make sure Tasks database is already setup. If not, create it.
  dbContext.create(client, databaseId, containerId);

  const { resource: createdItem } = container.items.create(dataReceived);
  console.log("created item", createdItem);
};

app.get("/getAllTasks", function (req, res) {
  const { endpoint, key, databaseId } = config;
  const client = new CosmosClient({ endpoint, key });
  const database = client.database(databaseId);
  const container = database.container("Items");
  var queryOptions = { populateQueryMetrics: true }
  const querySpec = {
    query: "SELECT * from c",
  };

  async function getdata() {
    const { result: results, headers } = await container.items
      .query(querySpec, queryOptions)
      .fetchAll();
      appInsightsClient.trackEvent({
        name: 'JS Get Request',
        properties: headers
      });
    res.send(results);

  }
  getdata();
  return true;
});

app.get("/getTaskById", function (req, res) {
  const { endpoint, key, databaseId } = config;
  var queryOptions = { populateQueryMetrics: true }
  const client = new CosmosClient({ endpoint, key });

  const database = client.database(databaseId);
  const container = database.container("Items");

  let id = req.query.id;
  console.log("id is",id);

  async function getdata() {
    const querySpec = {
      query: "SELECT * FROM c WHERE c.id = @id",
      parameters: [
        {
          name: "@id",
          value: req.query.id,
        },
      ],
    };

    const { result: results, headers } = await container.items
      .query(querySpec,queryOptions)
      .fetchAll();

    if (results &&  results.length == 0) {
      throw "No items found matching";
    } else if (results && results.length > 1) {
      throw "More than 1 item found matching";
    }
    appInsightsClient.trackEvent({
      name: 'JS GetById Request',
      properties: headers
    });

    console.log("result is",results);
    const item = results[0];
    console.log(item);

    res.send(item);
  }
  getdata();

  return true;
});

app.get("/deleteTaskById", function (req, res) {
  const { endpoint, key, databaseId } = config;

  const client = new CosmosClient({ endpoint, key });

  const database = client.database(databaseId);
  const container = database.container("Items");

  try {
    async function getdata() {
      const { result: results, headers } = await container
        .item(req.query.id, undefined)
        .delete();
      console.log(results);
      appInsightsClient.trackEvent({
        name: 'JS deleteById Request',
        properties: headers
      });
      res.send("Item deleted Successfully");
    }
    getdata();
  } catch (err) {
    console.log(err.message);
  }

  return true;
});

app.get("/updateTaskById", function (req, res) {
  const { endpoint, key, databaseId } = config;

  const client = new CosmosClient({ endpoint, key });

  const database = client.database(databaseId);
  const container = database.container("Items");

  try {
    async function getdata() {
      console.log(req.body, "body response");
      console.log(req.query.id, "id response");
      const { result: results, headers } = await container
        .item(req.query.id, undefined)
        .replace(req.body);
      res.send("Item Updated successfully");
      appInsightsClient.trackEvent({
        name: 'JS deleteById Request',
        properties: headers
      });
    }
    getdata();
  } catch (err) {
    appInsightsClient.trackException({
      name: 'JS deleteById Request',
      properties: err.message
    });
    console.log(err.message);
  }

  return true;
});

console.log("express running on server port 3000");
