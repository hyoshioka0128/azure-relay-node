var https = require('..')

var totalRequests = 10; // Total requests to send over the test
jest.setTimeout(5000 + (totalRequests * 200)); // Expect 5 seconds + 5 requests per second

test('Chunked HTTP POST', (done) => {
    var ns = process.env.SB_HC_NAMESPACE ? process.env.SB_HC_NAMESPACE.replace(/^"(.*)"$/, '$1') : null;
    var path = process.env.SB_HC_PATH ? process.env.SB_HC_PATH : "a2";
    var keyrule = process.env.SB_HC_KEYRULE ? process.env.SB_HC_KEYRULE.replace(/^"(.*)"$/, '$1') : null;
    var key = process.env.SB_HC_KEY ? process.env.SB_HC_KEY.replace(/^"(.*)"$/, '$1') : null;

    expect(ns).toBeDefined();
    expect(path).toBeDefined();
    expect(keyrule).toBeDefined();
    expect(key).toBeDefined();
    
    var listenerCount = 0;
    var senderCount = 0;

    /* set up the listener */
    var uri = https.createRelayListenUri(ns, path);
    var server = https.createRelayedServer({
            server: uri,
            token: () => https.createRelayToken(uri, keyrule, key)
        },
        (req, res) => {
            var chunks = '';
            expect(req.method).toBe("POST");
            expect(req.headers.custom).toBe("Hello");
            req.setEncoding('utf-8');
            req.on('data', (chunk) => {
                chunks = chunks + chunk;
            });
            req.on('end', () => {
                expect(chunks).toBe('12345678901234567890Hello');
                res.write('1234567890');
                res.write('1234567890');
                res.write('Hello');
                res.end();
                listenerCount++;
            });
        });

    // fail we get an error
    server.listen((err) => {
        expect(err).toBeUndefined();
    });
    // fail if we get an error (we'll always get one if this triggers)
    server.on('error', (err) => {
        expect(err).toBeUndefined();
    });
    
    /* set up the client */
    var clientUri = https.createRelayHttpsUri(ns, path);
    var token = https.createRelayToken(clientUri, keyrule, key);

    for (var i = 0; i < totalRequests; i++) {
        var req = https.request({
            hostname: ns,
            path: ((!path || path.length == 0 || path[0] !== '/') ? '/' : '') + path,
            port: 443,
            method : "POST",
            headers: {
                'ServiceBusAuthorization': token,
                'Custom' : 'Hello',
                'Content-Type': 'text/plain',
                //'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            var chunks = '';
            expect(res.statusCode).toBe(200);
            res.setEncoding('utf8');
            res.on('data', (chunk) => {
                chunks = chunks + chunk;
            });
            res.on('end', () => {
                expect(chunks).toBe('12345678901234567890Hello');
                senderCount++;
                if (listenerCount == totalRequests && senderCount == totalRequests) {
                    server.close();
                    done();
                }
            });
        }).on('error', (e) => {
            expect(e).toBeUndefined();
        });

        req.write('1234567890');
        req.write('1234567890');
        req.write('Hello');
        req.end();
    }
});