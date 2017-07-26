# OpenLMIS Service Template
This repository contains sample Requisition Web Data Connector and a Tableau simulator that interacts with it.

## Prerequisites
* node >= 0.10.0

## Running the simulator.
1. Fork/clone this repository from GitHub.
2. Install node dependencies
 ```shell
 npm install
 ```
3. Start the simulator
 ```shell
 npm start
 ```
4. Go to `http://<yourHostname>:3333/Simulator` .
5. The default connector URL points to requisition example (`../connector/index.html`)
6. Click on `Start interactive phase`.
7. Click `Connect with OpenLMIS` to authenticate with OpenLMIS. The default instance that the connector uses to is `http://test.openlmis.org`, you can change it in `openlmis-requisitions.js`
8. Select program name and click on `Get requisitions!`.
9. Scroll down and fetch table data.
10. You should see a table with requisition data, similar to the one in sample requisition report.
