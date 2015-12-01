
// http://addyosmani.com/resources/essentialjsdesignpatterns/book/#revealingmodulepatternjavascript
/**
 * Client for PacketTracer's HTTP API.
 */
var packetTracer = (function () {

    /** @const */ var ERROR_UNAVAILABLE = 1;
    /** @const */ var ERROR_TIMEOUT = 2;

    // Private utility functions
    function requestJSON(verb, url, data, customSettings) {
        var settings = { // Default values
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json'
            },
            type: verb,
            data: (data!=null)? JSON.stringify(data): null,
            dataType: 'json',
            timeout: 2000
        };
        for (var attrName in customSettings) { settings[attrName] = customSettings[attrName]; }  // merge
        return $.ajax(url, settings);
    }

    function getJSON(url, customSettings) {
        return requestJSON('GET', url, null, customSettings);
    }

    function postJSON(url, data, customSettings) {
        return requestJSON('POST', url, data, customSettings);
    }

    function putJSON(url, data, customSettings) {
        return requestJSON('PUT', url, data, customSettings);
    }

    function deleteHttp(url, customSettings) {
        var settings = {
            headers: {
              Accept: 'application/json'
            },
            type: 'DELETE',
            timeout: 2000
        };
        for (var attrName in customSettings) { settings[attrName] = customSettings[attrName]; }  // merge
        return $.ajax(url, settings);
    }


    // Session-level operations
    /**
     * Creates a new session.
     *   @param {string} apiURL
     *          Base URL of the HTTP API.
     *   @param {string} fileToOpen
     *          URL of the file to be opened at the beginning of the session.
     *   @param {function(string)} success
     *          Callback which receives the URL of the new session as a parameter.
     *   @return {jQuery.Deferred}
     */
    function createSession(apiURL, fileToOpen, success) {
        var newSession = { fileUrl: fileToOpen };
        return postJSON(apiURL + '/sessions', newSession, {}).
                  done(function(newSessionURL, status, xhr) {
                    // The following does not work in Jasmine.
                    //var newSessionURL = xhr.getResponseHeader('Location');
                    success(newSessionURL);
                  });
    }

    /**
     * Destroys a session and returns a jQuery  request object.
     *   @param {string} sessionURL
     *          URL of the session to be destroyed.
     *   @return {jQuery.Deferred}
     */
    function deleteSession(sessionURL) {
        return deleteHttp(sessionURL, {});
    }


    // Publicly exposed class with methods which call API resources

    /* Begin PTClient */
    /**
     * Creates a PTClient object.
     *   @param {string} sessionURL
     *          URL of the session that the client will use.
     *   @param {function()} onSessionExpired
   *            Callback to be called when the session expires.
     */
    function PTClient(sessionURL, onSessionExpired) {
        this.apiURL = sessionURL;
        this.customSettings = { // Custom values
            statusCode: {
                410: onSessionExpired
            }
        };
    }

    /**
     * Retrieves the current network topology.
     *   @param {function(number, number, number)} beforeRetry
     *          Function which will be called before a each retry.
     *          The first parameter is the current retry count.
     *          The second is the maximum number of retries.
     *          The third parameter corresponds with the type of error why
     *          the previous attempt failed: UNAVAILABLE or TIMEOUT.
     *   @return {jQuery.Deferred}
     */
    PTClient.prototype.getNetwork = function(beforeRetry) {
        var maxRetries = 5;
        var delayBetweenRetries = 2000;
        var sessionExpirationCallback = this.customSettings.statusCode['410'];
        var moreSpecificSettings = {
            tryCount : 0,
            retryLimit : maxRetries,
            statusCode: {
                404: sessionExpirationCallback,
                410: sessionExpirationCallback,
                503: function() {
                        this.tryCount++;
                        if (this.tryCount <= this.retryLimit) {
                            beforeRetry(this.tryCount, maxRetries, ERROR_UNAVAILABLE);
                            var thisAjax = this;
                            setTimeout(function() { $.ajax(thisAjax); }, delayBetweenRetries);  // retry
                        }
                    },
            },
            error : function(xhr, textStatus, errorThrown ) {
                if (textStatus == 'timeout') {
                    this.tryCount++;
                    console.error('The topology could not be loaded: timeout.');
                    if (this.tryCount <= this.retryLimit) {
                        beforeRetry(this.tryCount, maxRetries, ERROR_TIMEOUT);
                        $.ajax(this); // try again
                    }
                } else {
                   console.error('The topology could not be loaded: ' + errorThrown + '.');
                }
            }
        };
        return getJSON(this.apiURL + '/network', moreSpecificSettings);
    };

    PTClient.prototype.addDevice = function(newDevice) {
        return postJSON( this.apiURL + '/devices', newDevice, this.customSettings).
                fail(function() {
                    console.error('Something went wrong in the device creation.');
                });
    };

    PTClient.prototype.removeDevice = function(device) {
        return deleteHttp(device.url, this.customSettings).
                fail(function() {
                    console.error('Something went wrong in the device removal.');
                });
    };

    PTClient.prototype.modifyDevice = function(device, deviceLabel, defaultGateway) { // modify
        // General settings: PUT to /devices/id
        var modification = { label: deviceLabel };
        if (defaultGateway!="") {
            modification.defaultGateway = defaultGateway;
        }
        return putJSON(device.url, modification, this.customSettings).
                done(function(modifiedDevice) {
                    // FIXME This patch wouldn't be necessary if PTPIC library worked properly.
                    // NOTE: In subsequent .done's modifiedDevice will be received fixed.
                    modifiedDevice.defaultGateway = defaultGateway;
                }).
                fail(function() {
                    console.error('Something went wrong in the device modification.');
                });
    };

    PTClient.prototype.getAllPorts = function(device) {
        return getJSON(device.url + 'ports', this.customSettings).
                fail(function() {
                    console.error('Ports for the device ' + device.id + ' could not be loaded. Possible timeout.');
                });
    };

    PTClient.prototype.getAvailablePorts = function(device) {
        return getJSON(device.url + 'ports?free=true', this.customSettings).
                fail(function() {
                    console.error('Something went wrong getting this devices\' available ports ' + device.id + '.');
                });
    };

    PTClient.prototype.modifyPort = function(portURL, ipAddress, subnetMask) {
         // Send new IP settings
         var modification = {
             portIpAddress: ipAddress,
             portSubnetMask: subnetMask
         };
         return putJSON(portURL, modification, this.customSettings).
                fail(function() {
                    console.error('Something went wrong in the port modification.');
                });
    };

    PTClient.prototype.createLink = function(fromPortURL, toPortURL) {
        var modification = {
            toPort: toPortURL
        };
        return postJSON(fromPortURL + 'link', modification, this.customSettings).
                fail(function() {
                    console.error('Something went wrong in the link creation.');
                });
    };

    PTClient.prototype.removeLink = function(link) {
        // FIXME issue #4.
        return getJSON(link.url, this.customSettings).
                  fail(function(data) {
                      console.error('Something went wrong getting this link: ' + linkUrl + '.');
                  }).
                  then(function(data) {
                    return deleteHttp(data.endpoints[0] + 'link', this.customSettings).
                            fail(function() {
                                console.error('Something went wrong in the link removal.');
                            });
                  });
    };
    /* End PTClient */


    return {
        // Why an object instead of having all the functions defined at module level?
        //   1. To make sure that constructor is always called (and the base API URL is not missing).
        //   2. To allow having more than a client in the same application (although I am not sure whether this will be ever needed).
        UNAVAILABLE: ERROR_UNAVAILABLE,
        TIMEOUT: ERROR_TIMEOUT,
        Client: PTClient,
        newSession: createSession,
        destroySession: deleteSession,
    };
})();
