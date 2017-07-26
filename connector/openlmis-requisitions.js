(function() {
  'use strict';

  // This config stores the important strings needed to
  // connect to the OpenLMIS API and OAuth service
  var config = {
      clientId: 'tableau-wdc',
      redirectUri: window.location.href,
      apiUrl: 'https://test.openlmis.org/api/'
  };

  // Gets fragment (the part after '#') or regular url parameter with given name.
  // Used to extract user authorization data after he has been redirected.
  function getUrlParamOrFragment(name) {
      var results = new RegExp('[\?&#]' + name + '=([^&#]*)').exec(window.location.href);
      if (results != null) {
         return decodeURI(results[1]) || 0;
      }
  }

  // Called when web page first loads and when
  // the OAuth flow returns to the page
  //
  // This function parses the access token in the URI if available
  // It also adds a link to the OpenLMIS connect button
  $(document).ready(function() {
      var accessToken = getUrlParamOrFragment("access_token");

      var hasAuth = isTokenValid(accessToken);
      updateUIWithAuthState(hasAuth, accessToken);
      $("#connectbutton").click(function() {
          doAuthRedirect();
      });

      // Create event listeners for when the user submits the form
      $("#submitButton").click(function() {
          var options = {
            'programId': $("#program :selected").val()
          };
          tableau.connectionName = "OpenLMIS Requisition Data";
          tableau.connectionData = JSON.stringify(options);
          tableau.submit();
      });
  });

  // An on-click funcion for the connect to OpenLMIS button,
  // This will redirect the user to a OpenLMIS authorize page
  function doAuthRedirect() {
      var appId = config.clientId;
      if (tableau.authPurpose === tableau.authPurposeEnum.ephemerel) {
        appId = config.clientId;
      } else if (tableau.authPurpose === tableau.authPurposeEnum.enduring) {
        appId = config.clientId; // This should be the Tableau Server appID
      }

      var url = config.apiUrl + 'oauth/authorize?response_type=token&client_id=' + appId +
              '&redirect_uri=' + config.redirectUri;
      window.location.href = url;
  }

  //------------- OAuth Helpers -------------//
  // This helper function returns the URI for the requisitions endpoint
  // It appends the passed in programId and accessToken,
  function getRequisitionsURI(programId, accessToken) {
      var url = config.apiUrl + 'requisitions/search' + '?access_token=' + accessToken;
      if (!!programId) {
        url += '&program=' + programId;
      }
      return url;
  }

  // This function toggles the label shown and loads necessary data depending
  // on whether or not the user has been authenticated
  function updateUIWithAuthState(hasAuth, accessToken) {
      if (hasAuth) {
          $(".notsignedin").hide();
          $(".signedin").show();
          loadInputData(accessToken);
      } else {
          $(".notsignedin").show();
          $(".signedin").hide();
      }
  }

  // Creates options from json items (id and name are mandatory)
  // and appends them to specified select.
  function updateUIWithSelectOptions(select, items) {
    var options;
    $.each(items, function(i, item) {
        options += '<option value=' + item.id + '>' + item.name + '</option>';
    });
    select.empty().append(options);
  }

  // Loads data required for inputs
  function loadInputData(accessToken) {
      // Programs
      $.getJSON(config.apiUrl + 'programs?access_token=' + accessToken, function(data) {
          updateUIWithSelectOptions($("#program"), data);
      });
  }

  // Checks whether the access token is valid
  function isTokenValid(accessToken) {
    return !!accessToken && accessToken.length >= 36;
  }

  //------------- Tableau WDC code -------------//
  // Create tableau connector, should be called first
  var myConnector = tableau.makeConnector();

  // Init function for connector, called during every phase but
  // only called when running inside the simulator or tableau
  myConnector.init = function(initCallback) {
      tableau.authType = tableau.authTypeEnum.custom;

      var accessToken = getUrlParamOrFragment("access_token");
      var userId = getUrlParamOrFragment("referenceDataUserId");
      var hasAuth = isTokenValid(accessToken) || tableau.password.length > 0;
      updateUIWithAuthState(hasAuth, isTokenValid(accessToken) ? accessToken : tableau.password);

      initCallback();

      // If we are not in the data gathering phase, we want to store the token
      // This allows us to access the token in the data gathering phase
      if (tableau.phase == tableau.phaseEnum.interactivePhase || tableau.phase == tableau.phaseEnum.authPhase) {
          if (hasAuth) {
              if (!!accessToken) {
                tableau.username = userId;
                tableau.password = accessToken;
              }

              if (tableau.phase == tableau.phaseEnum.authPhase) {
                // Auto-submit here if we are in the auth phase
                tableau.submit()
              }

              return;
          }
      }
  };

  // Declare the data to Tableau that we are returning from OpenLMIS
  myConnector.getSchema = function(schemaCallback) {
      var schema = [];

      var cols = [
        { id: "facility", dataType: "string"},
        { id: "period", dataType: "string"},
        { id: "id", dataType: "string"},
        { id: "status", dataType: "string"}
      ];

      var tableInfo = {
        id: "RequisitionsTable",
        columns: cols
      }

      schema.push(tableInfo);

      schemaCallback(schema);
  };

  // This function acutally make the OpenLMIS API call and
  // parses the results and passes them back to Tableau
  myConnector.getData = function(table, doneCallback) {
      var dataToReturn = [];
      var hasMoreData = false;

      var userId = tableau.username;
      var accessToken = tableau.password;

      var options = JSON.parse(tableau.connectionData);
      var connectionUri = getRequisitionsURI(options.programId, accessToken);

      $.ajax({
          url: connectionUri,
          dataType: 'json',
          success: function (data) {
              if (data.content) {
                  var requisitions = data.content;

                  var ii;
                  for (ii = 0; ii < requisitions.length; ++ii) {
                      var requisition = {
                        'facility': requisitions[ii].facility.name,
                        'period': requisitions[ii].processingPeriod.name,
                        'id': requisitions[ii].id,
                        'status': requisitions[ii].status
                      };
                      dataToReturn.push(requisition);
                  }

                  table.appendRows(dataToReturn);
                  doneCallback();
              }
              else {
                  tableau.abortWithError("No results found");
              }
          },
          error: function (xhr, ajaxOptions, thrownError) {
              // WDC should do more granular error checking here
              // or on the server side.  This is just a sample of new API.
              console.log(thrownError);
              tableau.abortForAuth("Invalid Access Token");
          }
      });
  };

  // Register the tableau connector, call this last
  tableau.registerConnector(myConnector);
})();
