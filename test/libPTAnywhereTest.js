describe("packetTracer module", function() {

  var apiURL = 'http://192.168.34.202:8080/api/v1';
  var fileToOpen = 'http://192.168.34.202:8080/files/ibookdemo611.pkt';

  it("creates a new session", function(done) {

    packetTracer
      .newSession(apiURL, fileToOpen, function(newSessionURL) {
        // For some reason, when called using Jasmine
        // xhr.getAllResponseHeaders() does not return the 'Location' header
        expect(newSessionURL).not.toBe(null);
        packetTracer.destroySession(newSessionURL, function() {
          done();
        });
      })
      .fail(function() {
        done.fail("Session creation has failed.");
      });
  });

  describe("Client object", function() {
    var sessionUrl;
    var client;

    beforeEach(function(done) {
      jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;
      packetTracer.newSession(apiURL, fileToOpen, function(newSessionUrl) {
        sessionUrl = newSessionUrl;
        console.log("Creating client for session URL " + sessionUrl);
        client = new packetTracer.Client(sessionUrl, function() {
          done.fail("The session has expired.");
        });
        done();
      });
    });

    afterEach(function(done) {
      client = null;
      packetTracer.destroySession(sessionUrl, function() {
        done();
      });
    });

    // Related issue: https://github.com/PTAnywhere/ptAnywhere-js/issues/1
    it("creates device after deleting device", function(done) {
      client.getNetwork(function(network) {
        var d = network.devices[0];
        client.removeDevice(d).done(function() {
          client.addDevice({group: 'pc', x: 0, y: 0}, function() {
            done();
          }).fail(function(jqXHR, textStatus, errorThrown) {
            done.fail("The device was not added.");
          });
        }).fail(function() {
          done.fail("The device was not removed.");
        });
      },
      function(tryCount, maxRetries, errorCode) {
        done.fail("Timeout getting the network.");
      }).fail(function() {
        done.fail("The network was not loaded.");
      });
    });

    // Related issue: https://github.com/PTAnywhere/ptAnywhere-js/issues/1
    it("creates device after deleting link", function(done) {
      client.getNetwork(function(network) {
        var l = network.edges[0];
        client.removeLink(l).done(function() {
          client.addDevice({group: 'pc', x: 0, y: 0}, function() {
            done();
          }).fail(function(jqXHR, textStatus, errorThrown) {
            done.fail("The device was not added.");
          });
        }).fail(function() {
          done.fail("The link was not removed.");
        });
      },
      function(tryCount, maxRetries, errorCode) {
        done.fail("Timeout getting the network.");
      }).fail(function() {
        done.fail("The network was not loaded.");
      });
    });

  });

});
