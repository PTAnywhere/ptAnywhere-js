describe("packetTracer module", function() {

  var apiURL = 'http://192.168.34.202:8080/api/v1';
  var fileToOpen = 'http://192.168.34.202:8080/files/newibookdemo.pkt';

  it("creates and destroys sessions", function(done) {

    packetTracer
      .newSession(apiURL, fileToOpen, function(newSessionURL) {
        // For some reason, when called using Jasmine
        // xhr.getAllResponseHeaders() does not return the 'Location' header
        expect(newSessionURL).not.toBe(null);
        packetTracer.destroySession(newSessionURL).
          done(function() {
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
      packetTracer.destroySession(sessionUrl).
        done(function() {
          done();
        });
    });


    function getNetwork(done, success) {
      client.getNetwork(
        function(tryCount, maxRetries, errorCode) {
          done.fail("Timeout getting the network.");
        }).
        done(success).
        fail(function() {
          done.fail("The network was not loaded.");
        });
    }

    it("retrieves network", function(done) {
      getNetwork(done, function(network) {
        expect(network.devices.length).toBe(8);
        expect(network.edges.length).toBe(7);
        done();
      });
    });

    it("adds device", function(done) {
      client.addDevice({group: 'pc', x: 10, y: 20}).
        done(function(addedDevice) {
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
        client.removeDevice(toDelete).
          done(function(deletedDevice) {
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
        client.modifyDevice(toModify, 'New name', '10.0.0.1').
          done(function(modified) {
            expect(modified.label).toEqual('New name');
            expect(modified.defaultGateway).toEqual('10.0.0.1');
            done();
          }).
          fail(function() {
            done.fail("The device could not be modified.");
          });
      });
    });


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

    it("gets all ports for a device", function(done) {
      getDevice(done, 'MySwitch', function(mySwitch) {
        var expectedPorts = ['Vlan1', 'GigabitEthernet0/1', 'GigabitEthernet0/2'];
        for (var i=1; i<25; i++) {
          expectedPorts.push('FastEthernet0/' + i);
        }
        client.getAllPorts(mySwitch).
          done(function(ports) {
            for(var i in ports) {
              expect(expectedPorts).toContain(ports[i].portName);
            }
            done();
          }).
          fail(function() {
            done.fail("The ports could not be retrieved.");
          });
      });
    });

    it("gets available ports for a device", function(done) {
      getDevice(done, 'MySwitch', function(mySwitch) {
        var expectedPorts = ['Vlan1', 'GigabitEthernet0/1', 'GigabitEthernet0/2'];
        for (var i=4; i<25; i++) {
          expectedPorts.push('FastEthernet0/' + i);
        }
        client.getAvailablePorts(mySwitch).
          done(function(ports) {
            for(var i in ports) {
              expect(expectedPorts).toContain(ports[i].portName);
            }
            done();
          }).
          fail(function(error) {
              done.fail("The ports could not be retrieved.");
          });
      });
    });


    function getPort(done, deviceName, portName, success) {
      getDevice(done, deviceName, function(device) {
        client.getAllPorts(device).
          done(function(ports) {
            var retPort = null;
            for(var i in ports) {
              if (ports[i].portName===portName) {
                retPort = ports[i];
              }
            }
            if (retPort==null) {
              done.fail('Port not found in the device.');
            } else {
              success(retPort);
            }
          }).
          fail(function() {
            done.fail("The ports could not be retrieved.");
          });
      });
    }

    it("modifies ports", function(done) {
      getPort(done, 'RightHandSide', 'FastEthernet0', function(port) {
        client.modifyPort(port.url, '10.3.2.1', '255.255.0.0').
          done(function(modifiedPort) {
            expect(modifiedPort.portName).toEqual('FastEthernet0');
            expect(modifiedPort.portIpAddress).toEqual('10.3.2.1');
            expect(modifiedPort.portSubnetMask).toEqual('255.255.0.0');
            done();
          }).
          fail(function() {
            done.fail("The port could not be modified.");
          });
      });
    });

    it("links two ports", function(done) {
      getPort(done, 'MySwitch', 'FastEthernet0/5', function(port) {
        getPort(done, 'Switch7', 'FastEthernet0/1', function(port2) {
          client.createLink(port.url, port2.url).
            done(function(link) {
              expect(link.id).not.toBeNull();
              expect(link.url).not.toBeNull();
              done();
            }).
            fail(function() {
              done.fail("The link could not be created.");
            });
        });
      });
    });

    it("unlinks two ports", function(done) {
      getNetwork(done, function(network) {
        var toDelete = network.edges[0];
        client.removeLink(toDelete).
          done(function(deletedLink) {
            expect(deletedLink.id).toEqual(toDelete.id);
            expect(deletedLink.url).toEqual(toDelete.url);
            expect(deletedLink.from).not.toBeNull();
            expect(deletedLink.to).not.toBeNull();
            done();
          }).
          fail(function() {
            done.fail("The link could not be deleted.");
          });
      });
    });

    // Related issue: https://github.com/PTAnywhere/ptAnywhere-js/issues/1
    it("creates device after deleting device", function(done) {
      getNetwork(done, function(network) {
        var d = network.devices[0];
        client.removeDevice(d).
          done(function() {
            var l = client.addDevice({group: 'pc', x: 0, y: 0}).
                    done(function(addedDevice) {
                      expect(addedDevice.group).toBe('pcDevice');
                      expect(addedDevice.x).toBe(0);
                      expect(addedDevice.y).toBe(0);
                      done();
                    }).
                    fail(function(jqXHR, textStatus, errorThrown) {
                      done.fail("The device was not added.");
                    });
          }).
          fail(function() {
            done.fail("The device was not removed.");
          });
      });
    });

    // Related issue: https://github.com/PTAnywhere/ptAnywhere-js/issues/1
    it("creates device after deleting link", function(done) {
      getNetwork(done, function(network) {
        var l = network.edges[0];
        client.removeLink(l).
          done(function() {
            client.addDevice({group: 'pc', x: 0, y: 0}).
                    done(function(addedDevice) {
                      expect(addedDevice.group).toBe('pcDevice');
                      expect(addedDevice.x).toBe(0);
                      expect(addedDevice.y).toBe(0);
                      done();
                    }).fail(function(jqXHR, textStatus, errorThrown) {
                      done.fail("The device was not added.");
                    });
          }).
          fail(function() {
            done.fail("The link was not removed.");
          });
      });
    });

  });

});
