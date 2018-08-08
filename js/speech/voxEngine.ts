/** Rail Announcements Generator. By Roy Curtis, MIT license, 2018 */

/** Synthesizes speech by dynamically loading and piecing together voice files */
class VoxEngine
{
    /** The core audio context that handles audio effects and playback */
    public readonly audioContext : AudioContext;
    /** Audio node that filters voice with various effects */
    public readonly audioFilter  : BiquadFilterNode;

    /** Whether this engine is currently running and speaking */
    public  isSpeaking       : boolean      = false;
    /** Reference number for the current pump timer */
    private pumpTimer        : number       = 0;
    /** References to currently pending requests, as a FIFO queue */
    private pendingReqs      : VoxRequest[] = [];
    /** List of vox IDs currently being run through */
    private currentIds?      : string[];
    /** Voice currently being used */
    private currentVoice?    : CustomVoice;
    /** Speech settings currently being used */
    private currentSettings? : SpeechSettings;
    /** Audio buffer node holding and playing the current voice file */
    private currentBufNode?  : AudioBufferSourceNode;
    /** Audio node that adds a reverb to the voice, if available */
    private audioReverb?     : ConvolverNode;

    public constructor()
    {
        // Setup the core audio context

        // @ts-ignore
        let AudioContext = window.AudioContext || window.webkitAudioContext;

        this.audioContext = new AudioContext({
            latencyHint : "playback",
            // BUG: Not supported by browsers yet
            sampleRate  : 16000
        });

        // Setup tannoy filter

        this.audioFilter         = this.audioContext.createBiquadFilter();
        this.audioFilter.type    = 'highpass';
        this.audioFilter.Q.value = 0.4;

        this.audioFilter.connect(this.audioContext.destination);

        // Setup reverb

        // TODO: Make this user configurable and choosable
        fetch('data/vox/ir.stalbans_a_mono.wav')
            .then( res => res.arrayBuffer() )
            .then( buf => this.audioContext.decodeAudioData(buf) )
            .then( rev =>
            {
                this.audioReverb           = this.audioContext.createConvolver();
                this.audioReverb.buffer    = rev;
                this.audioReverb.normalize = true;

                this.audioFilter.connect(this.audioReverb);
                this.audioReverb.connect(this.audioContext.destination);
                console.debug('VOX REVERB LOADED');
            });
    }

    /**
     * Begins loading and speaking a set of vox files. Stops any speech.
     *
     * @param ids List of vox ids to load as files, in speaking order
     * @param voice Custom voice to use
     * @param settings Voice settings to use
     */
    public speak(ids: string[], voice: Voice, settings: SpeechSettings) : void
    {
        console.debug('VOX SPEAK:', ids, voice, settings);

        if (this.isSpeaking)
            this.stop();

        this.isSpeaking      = true;
        this.currentIds      = ids;
        this.currentVoice    = voice;
        this.currentSettings = settings;

        // Begin the pump loop
        this.pump();
    }

    /** Stops playing any currently spoken speech and resets state */
    public stop() : void
    {
        // Stop pumping
        clearTimeout(this.pumpTimer);

        this.isSpeaking = false;

        // Cancel all pending requests
        this.pendingReqs.forEach( r => r.cancel() );

        // Kill and dereference any currently playing file
        if (this.currentBufNode)
        {
            this.currentBufNode.stop();
            this.currentBufNode.disconnect();
            this.currentBufNode.onended = null;
            this.currentBufNode         = undefined;
        }

        this.currentIds      = undefined;
        this.currentVoice    = undefined;
        this.currentSettings = undefined;
        this.pendingReqs     = [];

        console.debug('VOX STOPPED');
    }

    /**
     * Pumps the speech queue, by keeping up to 10 fetch requests for voice files going,
     * and then feeding their data (in enforced order) to the audio chain, one at a time.
     */
    private pump() : void
    {
        console.debug('VOX PUMP');

        // If the engine has stopped, do not proceed.
        if (!this.isSpeaking || !this.currentIds || !this.currentVoice)
            return;

        // First, feed fulfilled requests into the audio buffer, in FIFO order
        this.playNext();

        // Then, fill any free pending slots with new requests
        while (this.currentIds[0] && this.pendingReqs.length < 10)
        {
            let id   = this.currentIds.shift();
            let path = `${this.currentVoice.voiceURI}/${id}.mp3`;

            this.pendingReqs.push( new VoxRequest(path) );
        }

        // Stop pumping when we're out of IDs to queue and nothing is playing
        if (this.currentIds.length <= 0 && !this.currentBufNode)
            this.stop();
        else
            this.pumpTimer = setTimeout(this.pump.bind(this), 1000);
    }

    /**
     * If there's a pending request and it's ready, and a buffer node is not currently
     * playing, then that next pending request is played. The buffer node created by this
     * method, automatically calls this method when playing is done.
     */
    private playNext() : void
    {
        // Ignore if there are no pending requests
        if (!this.pendingReqs[0] || !this.pendingReqs[0].isDone || this.currentBufNode)
            return;

        let req = this.pendingReqs.shift()!;

        console.log('VOX PLAYING:', req.path);

        // If the next request errored out (buffer missing), skip it
        // TODO: Replace with silence?
        if (!req.buffer)
            return this.playNext();

        this.currentBufNode        = this.audioContext.createBufferSource();
        this.currentBufNode.buffer = req.buffer;

        // Only connect to reverb if it's available
        this.currentBufNode.connect(this.audioFilter);
        this.currentBufNode.start();

        // Have this buffer node automatically try to play next, when done
        this.currentBufNode.onended = _ =>
        {
            if (!this.isSpeaking)
                return;

            this.currentBufNode = undefined;
            this.playNext();
        };
    }
}