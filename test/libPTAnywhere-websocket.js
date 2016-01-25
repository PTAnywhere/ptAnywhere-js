describe("PTAnywhere-WebSocket module", function() {

  var apiURL = 'http://192.168.34.202:8080/api/v1';
  var fileToOpen = 'http://192.168.34.202:8080/files/newibookdemo.pkt';

  var sessionUrl;
  var client;

  var scheduler = (function () {
      var FREQUENCY = 10;
      var commandCount;
      function reset() {
        commandCount = 0;
      }
      function getNextTick() {
        return FREQUENCY * commandCount++;
      }
      return {
        reset: reset,
        next: getNextTick
      };
  })();


  beforeEach(function(done) {
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;
    scheduler.reset();
    ptAnywhere.http.newSession(apiURL, fileToOpen, null, function(newSessionUrl) {
      sessionUrl = newSessionUrl;
      client = new ptAnywhere.http.Client(sessionUrl, function() {
        done.fail("The session has expired.");
      });
      done();
    });
  });

  afterEach(function(done) {
    client = null;
    ptAnywhere.http.destroySession(sessionUrl).
      done(function() {
        done();
      });
  });

  function getNetwork(done, success) {
    client.getNetwork(success,
      function(tryCount, maxRetries, errorCode) {
        done.fail("Timeout getting the network.");
      },
      function() {
        done.fail("Retry limit reached.");
      }).
      fail(function() {
        done.fail("The network was not loaded.");
      });
  }

  function getDevice(done, deviceName, success) {
    getNetwork(done, function(network) {
      var retDev = null;
      for (var i in network.devices) {
        if (network.devices[i].label === deviceName) {
          retDev = network.devices[i];
        }
      }
      if (retDev==null) {
        done.fail('Device not found in the network.');
      } else {
        success(retDev);
      }
    });
  }

  function getCommandLine(done, onConnect, onMessage, onReplace, onWarning) {
    getDevice(done, 'MySwitch', function(mySwitch) {
      expect(mySwitch.consoleEndpoint).not.toBe(null);
      ptAnywhere.websocket.start(
        mySwitch.consoleEndpoint,
        onConnect,
        onMessage,
        onReplace,
        onWarning);
    });
  }

  it("connects to command line", function(done) {
    getCommandLine(done,
      function() {
        done();
      },
      null, null, null
    );
  });

  it("sends commands", function(done) {
    var expectedOutput = [
      '', '', 'Switch>', 's', 'h', 'o', 'w', '', 'v'
    ];
    var msgCount = 0;
    getCommandLine(done,
      function() {
        ptAnywhere.websocket.send('show version');
      },
      function(message) {
        if (msgCount < expectedOutput.length) {
          //console.log(message);
          expect(message.trim()).toBe(expectedOutput[msgCount]);
        } else {
          // We could check the rest of the messages, but I prefer to ignore them.
          done();
        }
        msgCount++;
      },
      null, null
    );
  });


  function sendCommands(done, commands, replaceCommandCallback) {
    getCommandLine(done,
      function() {
        // Sample commands to be registered in the history.
        for(var i in commands) {
          setTimeout(function(command) {
            ptAnywhere.websocket.send(command);
          },
          scheduler.next(),
          commands[i] );
        }
      },
      function(message) {},
      replaceCommandCallback,
      null
    );
  }

  function getPrevious(expectedCommand, when, setExpected) {
    setTimeout(function(command) {
      setExpected(command);
      ptAnywhere.websocket.previous();
    }, when, expectedCommand);
  }

  function getNext(expectedCommand, when, setExpected) {
    setTimeout(function(command) {
      setExpected(command);
      ptAnywhere.websocket.next();
    }, when, expectedCommand);
  }

  it("manages command history", function(done) {
    // WARNING: 'exit' => clears the history.
    var commands = ['show users', 'show history', 'enable', 'disable'];
    var expectedCommand = null;
    var receivedCallbacks = 0;

    sendCommands(done, commands,
      function(command, showCurrentIfNull) {
        expect(command).toBe(expectedCommand);
        receivedCallbacks++;
      }
    );

    var delay = 1000;
    var setExpected = function(command) { expectedCommand = command; };
    for(var i in commands) {
      getPrevious(commands[commands.length - i - 1],
        delay + scheduler.next(),
        setExpected
      );
    }

    // No more previous command
    getPrevious(null, delay + scheduler.next(), setExpected);

    // Get next command
    for(var i=1; i<commands.length; i++) {
      getNext(commands[i], delay + scheduler.next(), setExpected);
    }

    // No more next command
    getNext(null, delay + scheduler.next(), setExpected);

    delay += 500;
    setTimeout(
      function() {
        expect(receivedCallbacks).toBe(commands.length*2+1);
        done();
      },
      delay + scheduler.next()
    );
  });
});
