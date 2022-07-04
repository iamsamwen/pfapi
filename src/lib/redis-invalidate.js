'use strict';

const logging = require('../app/logging');

module.exports = {
    on_invalidate,
    off_invalidate,
};

async function on_invalidate(redis, on_event, {prefix,  bcast = true, noloop = true}) {

    return await redis.get_client(async (new_client) => {

        const client = await redis.get_client();

        try {

            const id = await redis.get_client_id(new_client);
            const argv = ['tracking', 'on', 'redirect', id, 'prefix', prefix]; 
            if (bcast) argv.push('bcast');
            if (noloop) argv.push('noloop');

            if (await redis.send_command({client, cmd: 'client', argv}) !== 'OK') {
                logging.error('on_invalidate, failed to send_command');
                return;
            }

            if (await new_client.subscribe('__redis__:invalidate') !== 1) {
                logging.error('on_invalidate, failed to subscribe');
                return;
            }

            new_client.on('message', async (channel, data) => {
                const current_id = await redis.get_client_id(new_client);
                //logging.debug('on_invalidate receive message', {current_id, id, channel, data});
                if (current_id !== id) {
                    await off_invalidate_by_id(redis, client, id);
                    return;
                }
                const redis_keys = data.split(',');
                await on_event(redis_keys);
            });

        } catch(err) {
            logging.error(err);
        }
    });
}

async function off_invalidate(redis, subscribe_client) {

    const client = await redis.get_client();
    const id = await redis.get_client_id(subscribe_client);
    return off_invalidate_by_id(redis, client, id);

}

async function off_invalidate_by_id(redis, client, id) {

    const argv = ['tracking', 'off', 'redirect', id];
    const result = await redis.send_command({client, cmd: 'client', argv});
    if (result !== 'OK') {
        logging.error('turnoff_invalidate, failed to send_command');
        return false;
    }
    return true;
}
