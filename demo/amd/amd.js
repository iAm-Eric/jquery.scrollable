requirejs.config( {

    baseUrl: '../../bower_components',

    paths: {
        'jquery': '../demo/bower_demo_components/jquery/dist/jquery',
        'jquery.documentsize': '/bower_components/jquery.documentsize/dist/amd/jquery.documentsize',
        'jquery.scrollable': '/dist/amd/jquery.scrollable',
        'underscore': '../demo/bower_demo_components/underscore/underscore'
    },

    shim: {
        'underscore': {
            exports: '_'
        }
    }

} );

require( [

    'jquery',
    'underscore',
    'jquery.scrollable'

], function ( $, _ ) {

    $( function () {

        var $window = $( window ),
            $body = $( document.body ),

            $controlsPane = $( ".scroll-controls" ),
            $controls = $( "a", $controlsPane ),

            $feedbackPane = $( ".feedback" ),
            $feedbackX_px = $( ".x-px", $feedbackPane ),
            $feedbackX_percent = $( ".x-percent", $feedbackPane ),
            $feedbackY_px = $( ".y-px", $feedbackPane ),
            $feedbackY_percent = $( ".y-percent", $feedbackPane );

        // Make sure the document body is larger than the window by at least 2000px in each dimension
        $body
            .css( {
                minWidth:  ( $window.width() + 2000 ) + "px",
                minHeight: ( $window.height() + 2000 ) + "px"
            } );

        // Add a gradient background by injecting a "gradient background div". This is a terrible hack.
        //
        // Setting the gradient directly on the body didn't work as intended. The gradient just extended across the
        // screen, not across the full body size. Beyond the screen, the gradient was repeated, creating a pattern. Body
        // somehow seems to be confused with "window". Observed in Chrome 43 (May 2015).
        //
        // (Adding the gradient class after setting the final body size didn't change this, either.)
        $( "<div/>" ).appendTo( $body ).addClass( "maxed gradient" );

        // Hide the info header, show controls
        $( "#header" ).delay( 2000 ).fadeOut( 800, function () {
            $controlsPane.show();
        } );

        $controls.click( function ( event ) {
            var $elem = $( this );

            event.preventDefault();

            $window.scrollTo( {
                x: $elem.data( "x" ),
                y: $elem.data( "y" )
            }, {
                duration: 2000,
                append: true            // In the demo, we complete each scroll animation before we start the next one.
                                        // (We could also drop `append` and use `jumpToTargetPosition: true`instead -
                                        // completes the ongoing animation in an instant when asked to do a new one.)
            } );

        } );

        $window.scroll( _.throttle( updateFeedback, 100 ) );
        updateFeedback();

        function updateFeedback () {
            var posX = $window.scrollLeft(),
                posY = $window.scrollTop(),
                range = $window.scrollRange();

            $feedbackX_px.text( posX + "px" );
            $feedbackX_percent.text( toPercent( posX, range.horizontal, 4 ) + "%" );

            $feedbackY_px.text( posY + "px" );
            $feedbackY_percent.text( toPercent( posY, range.vertical, 4 ) + "%" );
        }

    } );

    function toPercent ( pos, scrollRange, decimals ) {
        var percentage = pos * 100 / scrollRange,
            shift = Math.pow( 10, decimals || 0 );

        return Math.round( percentage * shift ) / shift;
    }

} );
