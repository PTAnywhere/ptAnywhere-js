
describe("packetTracer module", function() {

  it("creates a new session", function(done) {
    var apiURL = 'http://192.168.34.202:8080/api/v1';
    var fileToOpen = 'http://192.168.34.202:8080/files/ibookdemo611.pkt';
    packetTracer
      .newSession(apiURL, fileToOpen, function(newSessionURL) {
        // For some reason, when called using Jasmine
        // xhr.getAllResponseHeaders() does not return the 'Location' header
        //expect(newSessionURL).not.toBe(null);
        done();
      })
      .fail( function() {
        fail("Session creation has failed.");
      });
  });

  it("creates device after deleting", function(done) {
    var apiURL = 'http://192.168.34.202:8080/api/v1/sessions/zeOItQSxRCS03DwAA8sQsg--';
    var cli = new packetTracer
                    .Client(apiURL, function() {
                      fail("The session has expired.");
                    });
    cli.getNetwork(function(network) {
      var d = network.devices[0];
      console.log(d);
      cli.removeDevice(d).done(function() {
        cli.addDevice(d, function() {
          done();
        }).fail(function(jqXHR, textStatus, errorThrown) {
          console.log(textStatus);
          done.fail("The device was not added.");
        });
      }).fail(function() {
        done.fail("The device was not removed.");
      });
    },
    function(tryCount, maxRetries, errorCode) {
    }).fail(function() {
      done.fail("The network was not loaded.");
    });
  });

});
