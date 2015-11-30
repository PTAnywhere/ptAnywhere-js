describe("packetTracer module", function() {

  var apiURL = 'http://192.168.34.202:8080/api/v1';
  var fileToOpen = 'http://192.168.34.202:8080/files/ibookdemo611.pkt';

  it("creates and destroys sessions", function(done) {

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


    function getNetwork(done, success) {
      client.getNetwork(success,
        function(tryCount, maxRetries, errorCode) {
          done.fail("Timeout getting the network.");
        }).
      fail(function() {
        done.fail("The network was not loaded.");
      });
    }

    it("retrieves network", function(done) {
      getNetwork(done, function(network) {
        expect(network.devices.length).toBe(5);
        expect(network.edges.length).toBe(4);
        done();
      });
    });

    it("adds device", function(done) {
      client.addDevice({group: 'pc', x: 10, y: 20}, function(addedDevice) {
        expect(addedDevice).toEqual(jasmine.objectContaining({
          group: 'pcDevice', x: 10, y: 20
        }));
        done();
      }).
      fail(function() {
        done.fail("The device could not be added.");
      });
    });

    it("removes device", function(done) {
      getNetwork(done, function(network) {
        toDelete = network.devices[0];
        client.removeDevice(toDelete).done(function(deletedDevice) {
          expect(deletedDevice).toEqual(toDelete);
          done();
        }).
        fail(function() {
          done.fail("The device could not be deleted.");
        });
      });
    });

    it("modifies device", function(done) {
      getNetwork(done, function(network) {
        toModify = network.devices[0];
        client.modifyDevice(toModify, 'New name', '10.0.0.1', function(modified) {
          expect(modified.label).toEqual('New name');
          expect(modified.defaultGateway).toEqual('10.0.0.1');
          done();
        }).
        fail(function() {
          done.fail("The device could not be modified.");
        });
      });
    });

    // Related issue: https://github.com/PTAnywhere/ptAnywhere-js/issues/1
    it("creates device after deleting device", function(done) {
      getNetwork(done, function(network) {
        var d = network.devices[0];
        client.removeDevice(d).done(function() {
          client.addDevice({group: 'pc', x: 0, y: 0}, function(addedDevice) {
            expect(addedDevice.group).toBe('pcDevice');
            expect(addedDevice.x).toBe(0);
            expect(addedDevice.y).toBe(0);
            done();
          }).fail(function(jqXHR, textStatus, errorThrown) {
            done.fail("The device was not added.");
          });
        }).fail(function() {
          done.fail("The device was not removed.");
        });
      });
    });

    // Related issue: https://github.com/PTAnywhere/ptAnywhere-js/issues/1
    it("creates device after deleting link", function(done) {
      getNetwork(done, function(network) {
        var l = network.edges[0];
        client.removeLink(l).done(function() {
          client.addDevice({group: 'pc', x: 0, y: 0}, function(addedDevice) {
            expect(addedDevice.group).toBe('pcDevice');
            expect(addedDevice.x).toBe(0);
            expect(addedDevice.y).toBe(0);
            done();
          }).fail(function(jqXHR, textStatus, errorThrown) {
            done.fail("The device was not added.");
          });
        }).fail(function() {
          done.fail("The link was not removed.");
        });
      });
    });

  });

});
