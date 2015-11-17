
describe("packetTracer module test suite", function() {

  it("creates a new session", function() {
    var apiURL = 'http://192.168.34.202:8080/api/v1';
    var fileToOpen = 'http://192.168.34.202:8080/files/ibookdemo611.pkt';
    packetTracer
      .newSession(apiURL, fileToOpen, function(newSessionURL) {
        expect(newSessionURL).not.toBe(null);
        console.log(newSessionURL);
        done();
      })
      .fail( function() {
        fail("Session creation has failed.");
      });
  });

});
