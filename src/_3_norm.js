( function ( norm, lib, queue ) {
    "use strict";

    /** @type {string[]}  non-canonical but recognized names for the vertical axis */
    var altAxisNamesV = [ "v", "y", "top" ],

        /** @type {string[]}  non-canonical but recognized names for the horizontal axis */
        altAxisNamesH = [ "h", "x", "left" ],

        /** @type {string[]}  non-canonical but recognized names for both axes */
        altAxisNamesBoth = [ "vh", "hv", "xy", "yx", "all" ],

        /** @type {string[]}  all non-canonical but recognized names for one or both axes */
        altAxisNames = altAxisNamesV.concat( altAxisNamesH, altAxisNamesBoth );

    /** @type {string}  canonical name for the vertical axis */
    norm.VERTICAL = "vertical";

    /** @type {string}  canonical name for the horizontal axis */
    norm.HORIZONTAL = "horizontal";

    /** @type {string}  canonical name for both axes */
    norm.BOTH_AXES = "both";

    /** @type {number}  scroll position value signalling that the axis should not be scrolled */
    norm.IGNORE_AXIS = -999;

    /** @type {Object}  default scroll options */
    norm.defaults = {
        axis: norm.VERTICAL,
        queue: "internal.jquery.scrollable"
    };

    /** @type {string}  "replace" mode flag for chained scrollTo calls */
    norm.MODE_REPLACE = "replace";

    /** @type {string}  "append" mode flag for chained scrollTo calls */
    norm.MODE_APPEND = "append";

    /** @type {string}  "merge" mode flag for chained scrollTo calls */
    norm.MODE_MERGE = "merge";


    /**
     * Normalizes the container element, if it relates to a window. Other elements are returned unchanged.
     *
     * - It maps `documentElement` and `body` to the window.
     * - It maps an iframe element to its content window.
     * - It returns other elements unchanged.
     * - It returns an empty jQuery set as is.
     *
     * Elements are expected in a jQuery wrapper, and are returned in a jQuery wrapper.
     *
     * @param   {jQuery} $container
     * @returns {jQuery}
     */
    norm.normalizeContainer = function ( $container ) {
        var container = $container[0],
            tagName = container && container.tagName && container.tagName.toLowerCase(),
            isIframe = tagName === "iframe",
            isWindow = !tagName || tagName === "html" || tagName === "body";

        return isWindow ? $( lib.ownerWindow( container ) ) : isIframe ? $( container.contentWindow ) : $container;
    };

    /**
     * Returns a hash of scroll positions. The position on each axis is normalized to a number (in px) and limited to
     * the available scroll range. If the position is passed in as a hash, the axis properties are normalized to their
     * canonical names as well ("horizontal"/"vertical").
     *
     * The container element is expected to be normalized. So is the options hash.
     *
     * If a position hash is passed in, one axis can be left undefined if it shouldn't be scrolled (e.g.
     * { vertical: 100 } - note the missing horizontal dimension). Null or "" are treated the same as undefined.
     *
     * If only one axis is to be scrolled (as specified by the options or the position hash), the other one is set to
     * norm.IGNORE_AXIS in the returned hash.
     *
     * If a hash has been passed in, that original hash remains untouched. A separate object is returned.
     *
     * Percentages are calculated in relation to container size. A simple percentage string is calculated for vertical
     * scroll, ie relative to container height, unless the axis option says otherwise. For a hash, percentages are
     * applied per axis.
     *
     * The normalization of values works as follows:
     *
     * - A number is returned as is.
     * - A string ending in "px" is turned into a number.
     * - A string ending in "%" is converted to its px value, relative to container size on the specified axis.
     * - A string "top" or "left" is converted to 0.
     * - A string "bottom", "right" is converted to the maximum scroll value on the respective axis.
     * - A string prefixed with "+=" or "-=", which means that the position is relative to the current scroll position,
     *   is turned into an absolute position. If the scroll is appended or merged, the move is based on the position
     *   which the preceding scroll will arrive at, rather than the current position.
     * - Hash properties "v"/"h", "y"/"x" are converted into "vertical"/"horizontal" properties.
     * - Hash property values are converted according to the rules for primitives.
     * - Missing hash properties are filled in with norm.IGNORE_AXIS.
     *
     * @param {number|string|Object} position
     * @param {jQuery}               $container
     * @param {jQuery}               $scrollable
     * @param {Object}               options     must have the axis and queue property set (which is the case in a
     *                                           normalized options object)
     * @returns {Coordinates}
     */
    norm.normalizePosition = function ( position, $container, $scrollable, options ) {

        var queueWrapper = new queue.QueueWrapper( $scrollable, options.queue );

        if ( $.isPlainObject( position ) ) {
            return normalizePositionForHash( position, $container, options, queueWrapper );
        } else {
            return normalizePositionForAxis( position, $container, options, queueWrapper );
        }
    };

    /**
     * Normalizes a position hash.
     *
     * Delegates to normalizePositionForAxis(). For info, see norm.normalizePosition().
     *
     * @param   {Object}             position
     * @param   {jQuery}             $container
     * @param   {Object}             options       must have the axis property set (which is the case in a normalized
     *                                             options object)
     * @param   {queue.QueueWrapper} queueWrapper
     * @returns {Coordinates}
     */
    function normalizePositionForHash ( position, $container, options, queueWrapper ) {

        var axis = options.axis,
            pos = normalizeAxisProperty( position ),
            posX = pos[norm.HORIZONTAL],
            posY = pos[norm.VERTICAL],
            ignoreX = axis === norm.VERTICAL,
            ignoreY = axis === norm.HORIZONTAL,
            optionsX = $.extend( {}, options, { axis: norm.HORIZONTAL } ),
            optionsY = $.extend( {}, options, { axis: norm.VERTICAL } ),
            normalized = {};

        // NB Merge mode: if an axis is ignored in the current scroll operation, a target may nevertheless be inherited
        // from previous, unfinished scrollTo commands. Read it from the queue then.
        normalized[norm.HORIZONTAL] = ignoreX ?
                                      ( options.merge ? getLastPositionInfo( queueWrapper, norm.HORIZONTAL ) : norm.IGNORE_AXIS ) :
                                      normalizePositionForAxis( posX, $container, optionsX, queueWrapper )[norm.HORIZONTAL];
        normalized[norm.VERTICAL] = ignoreY ?
                                    ( options.merge ? getLastPositionInfo( queueWrapper, norm.VERTICAL ) : norm.IGNORE_AXIS ) :
                                    normalizePositionForAxis( posY, $container, optionsY, queueWrapper )[norm.VERTICAL];

        return normalized;
    }

    /**
     * Normalizes a numeric or string position.
     *
     * For info, see norm.normalizePosition().
     *
     * @param   {number|string}      position
     * @param   {jQuery}             $container
     * @param   {Object}             options       must have the axis property set (which is the case in a normalized
     *                                             options object)
     * @param   {queue.QueueWrapper} queueWrapper
     * @returns {Coordinates}
     */
    function normalizePositionForAxis ( position, $container, options, queueWrapper ) {

        var otherAxis, prefix,
            origPositionArg = position,
            basePosition = 0,
            sign = 1,
            axis = options.axis,
            scrollMode = getScrollMode( options ),
            normalized = {};


        // Working in one dimension only. We need a precise statement of the axis (axis: "both" is not enough here -
        // we need to know which one).
        if ( !( axis === norm.HORIZONTAL || axis === norm.VERTICAL ) ) throw new Error( "Axis option not defined, or not defined unambiguously, with current value " + axis );

        // Convert string input to number
        if ( lib.isString( position ) ) {

            position = position.toLowerCase();

            // Deal with +=, -= relative position prefixes
            prefix = position.slice( 0, 2 );
            if ( prefix === "+=" || prefix === "-=" ) {
                position = position.slice( 2 );
                sign = prefix === "+=" ? 1 : -1;
                basePosition = getStartScrollPosition( $container, queueWrapper, axis, scrollMode );
            }

            // Resolve px, % units
            if ( position.slice( -2 ) === "px" ) {
                position = parseFloat( position.slice( 0, -2 ) );
            } else if ( position.slice( -1 ) === "%" ) {
                position = parseFloat( position.slice( 0, -1 ) ) * lib.getScrollMaximum( $container, axis ) / 100;
            } else {

                // Resolve position strings
                if ( axis === norm.HORIZONTAL ) {

                    if ( position === "left" ) position = 0;
                    if ( position === "right" ) position = lib.getScrollMaximum( $container, axis );
                    if ( position === "top" || position === "bottom" ) throw new Error( "Desired position " + position + "is inconsistent with axis option " + axis );

                } else {

                    if ( position === "top" ) position = 0;
                    if ( position === "bottom" ) position = lib.getScrollMaximum( $container, axis );
                    if ( position === "left" || position === "right" ) throw new Error( "Desired position " + position + "is inconsistent with axis option " + axis );

                }

            }

            // Convert any remaining numeric string (e.g. "100") to a number
            if ( lib.isString( position ) && $.isNumeric( position ) ) position = parseFloat( position );

        }

        if ( lib.isNumber( position ) ) {

            // Calculate the absolute position. Explicit rounding is required because scrollTop/scrollLeft cuts off
            // fractional pixels, rather than rounding them.
            position = Math.round( basePosition + sign * position );
            normalized[axis] = limitToScrollRange( position, $container, axis );

        } else if ( isUndefinedPositionValue( position ) ) {
            // Ignore axis, unless we are in merge mode and a previous target value can be extracted from the queue.
            normalized[axis] = scrollMode === norm.MODE_MERGE ? getLastPositionInfo( queueWrapper, axis ) : norm.IGNORE_AXIS;
        } else {
            // Invalid position value
            throw new Error( "Invalid position argument " + origPositionArg );
        }

        // Single axis here, hence the other axis is not dealt with - set to "ignore axis"
        otherAxis = axis === norm.HORIZONTAL ? norm.VERTICAL : norm.HORIZONTAL;
        normalized[otherAxis] = norm.IGNORE_AXIS;

        return normalized;

    }

    /**
     * Normalizes the options hash and applies the defaults. Does NOT expect the position argument to be normalized.
     *
     * The requested scroll position is required as an argument because the axis default depends on the position format:
     *
     * - If the position is passed in as a primitive (single axis), the axis defaults to "vertical".
     * - If the position is passed in as a primitive but has an implicit axis, that axis becomes the default (positions
     *   "top", "bottom", "left", "right")
     * - If the position is passed in as a hash, with both axes specified, the axis defaults to "both".
     * - If the position is passed in as a hash with just one axis specified, the axis defaults to "vertical" or
     *   "horizontal", depending on the position property.
     *
     * The options hash is normalized in the following ways:
     *
     * - It is converted to canonical axis names.
     * - The `queue` property is filled in with its default value, unless a queue is provided explicitly.
     *
     * Does not touch the original hash, returns a separate object instead.
     *
     * If no options hash is provided, the defaults are returned.
     *
     * @param   {Object|undefined}      options
     * @param   {number|string|Object}  [position]  you can omit the position when not dealing with axes, e.g. when
     *                                              handling stopScroll options
     * @returns {Object}
     */
    norm.normalizeOptions = function ( options, position ) {

        var hasX, hasY,
            axisDefault = norm.defaults.axis;

        // Normalize the axis property names
        options = options ? normalizeAxisProperty( options ) : {};

        // Determine the axis default value
        if ( $.isPlainObject( position ) ) {

            position = normalizeAxisProperty( position );
            hasX = !isUndefinedPositionValue( position[norm.HORIZONTAL] ) && position[norm.HORIZONTAL] !== norm.IGNORE_AXIS;
            hasY = !isUndefinedPositionValue( position[norm.VERTICAL] ) && position[norm.VERTICAL] !== norm.IGNORE_AXIS;

            axisDefault = ( hasX && hasY ) ? norm.BOTH_AXES : hasX ? norm.HORIZONTAL : norm.VERTICAL;

        } else if ( lib.isString( position ) ) {

            position = position.toLowerCase();

            if ( position === "top" || position === "bottom" ) {
                axisDefault = norm.VERTICAL;
            } else if ( position === "left" || position === "right" ) {
                axisDefault = norm.HORIZONTAL;
            }

        }

        // Apply defaults where applicable
        return $.extend( {}, norm.defaults, { axis: axisDefault }, options );

    };

    /**
     * Accepts any of the recognized names for an axis and returns the canonical axis name.
     *
     * Throws an error if the argument is not recognized as an axis name.
     *
     * @param   {string} name
     * @returns {string}
     */
    norm.normalizeAxisName = function ( name ) {

        if ( lib.isInArray( name, altAxisNamesV ) ) {
            name = norm.VERTICAL;
        } else if ( lib.isInArray( name, altAxisNamesH ) ) {
            name = norm.HORIZONTAL;
        } else if ( lib.isInArray( name, altAxisNamesBoth ) ) {
            name = norm.BOTH_AXES;
        }

        if ( !( name === norm.VERTICAL || name === norm.HORIZONTAL || name === norm.BOTH_AXES ) ) throw new Error( "Invalid axis name " + name );

        return name;

    };

    /**
     * Makes sure the position is within the range which can be scrolled to. The container element is expected to be
     * normalized.
     *
     * @param   {number} position
     * @param   {jQuery} $container
     * @param   {string} axis        "vertical" or "horizontal"
     * @returns {number}
     */
    function limitToScrollRange ( position, $container, axis ) {

        position = Math.min( position, lib.getScrollMaximum( $container, axis ) );
        position = Math.max( position, 0 );

        return position;

    }

    /**
     * Returns the current scroll position for a container on a given axis. The container element is expected to be
     * normalized.
     *
     * @param   {jQuery} $container
     * @param   {string} axis        "vertical" or "horizontal"
     * @returns {number}
     */
    function getCurrentScrollPosition ( $container, axis ) {
        return axis === norm.HORIZONTAL ? $container.scrollLeft() : $container.scrollTop();
    }

    /**
     * Returns the start position for a new scroll movement, on a given axis.
     *
     * Usually, that is the current scroll position. In append or merge mode, the final target position of preceding
     * animations is returned, if any such animations exist.
     *
     * @param   {jQuery}             $container
     * @param   {queue.QueueWrapper} queueWrapper
     * @param   {string}             axis          "horizontal" or "vertical"
     * @param   {string}             scrollMode    "replace", "append", "merge"
     * @returns {number}
     */
    function getStartScrollPosition ( $container, queueWrapper, axis, scrollMode ) {
        var position;

        // We only care about the final scroll target of preceding scrolls if we have to base a new scroll on it (append
        // mode)
        if ( scrollMode === norm.MODE_APPEND || scrollMode === norm.MODE_MERGE ) position = getLastPositionInfo( queueWrapper, axis );

        if ( position === undefined || position === norm.IGNORE_AXIS ) position = getCurrentScrollPosition( $container, axis );

        return position;
    }

    /**
     * Returns the last position info which can be retrieved from the queue, for one or both axes. This is the position
     * which all preceding scroll movements eventually arrive at.
     *
     * The result is returned as a hash { vertical: ..., horizontal: ... } by default, or as a number if the query is
     * restricted to a single axis.
     *
     * Values are absolute, fully resolved target positions and numeric. If there is no info for an axis (because the
     * queue is empty or animations target the other axis only), norm.IGNORE_AXIS is returned for it.
     *
     * @param   {queue.QueueWrapper} queueWrapper
     * @param   {string}             [axis="both"]  "horizontal", "vertical", "both"
     * @returns {Coordinates|number}
     */
    function getLastPositionInfo ( queueWrapper, axis ) {
        var retrievedX, retrievedY,
            returnBothAxes = !axis || axis === norm.BOTH_AXES,
            last = {},
            infoEntries = queueWrapper.getInfo();

        // Set the default return value if there is no info for an axis
        last[norm.HORIZONTAL] = last[norm.VERTICAL] = norm.IGNORE_AXIS;

        // Extract the last position info for each axis which is not norm.IGNORE_AXIS
        $.each( infoEntries, function ( index, info ) {
            if ( info.position ) {
                retrievedX = info.position[norm.HORIZONTAL];
                retrievedY = info.position[norm.VERTICAL];
                if ( retrievedX !== undefined && retrievedX !== norm.IGNORE_AXIS ) last[norm.HORIZONTAL] = retrievedX;
                if ( retrievedY !== undefined && retrievedY !== norm.IGNORE_AXIS ) last[norm.VERTICAL] = retrievedY;
            }
        } );

        return returnBothAxes ? last : last[axis];
    }

    /**
     * Takes a hash of options or positions and returns a copy, with axis names normalized.
     *
     * @param   {Object} inputHash
     * @returns {Object}
     */
    function normalizeAxisProperty ( inputHash ) {
        var normalized = {};

        $.each( inputHash, function ( key, value ) {
            if ( lib.isInArray( key, altAxisNames ) ) {
                normalized[norm.normalizeAxisName( key )] = value;
            } else {
                normalized[key] = value;
            }
        } );

        return normalized;
    }

    /**
     * Returns the scroll mode after examining the animation options.
     *
     * @param   {Object} animationOptions
     * @returns {string}
     */
    function getScrollMode ( animationOptions ) {
        return animationOptions.append ? norm.MODE_APPEND : animationOptions.merge ? norm.MODE_MERGE : norm.MODE_REPLACE;
    }

    /**
     * Returns if a position value is considered undefined. That is the case when it is set to undefined, null, false,
     * or an empty string.
     *
     * ATTN For primitive values only. Does NOT deal with a position hash!
     *
     * @param   {number|string|boolean|null|undefined} positionValue
     * @returns {boolean}
     */
    function isUndefinedPositionValue ( positionValue ) {
        return positionValue === undefined || positionValue === null || positionValue === false || positionValue === "";
    }

    /**
     * Custom types.
     *
     * For easier documentation and type inference.
     */

    /**
     * @name Coordinates
     * @type {Object}
     *
     * @property {number} horizontal
     * @property {number} vertical
     */

} )( norm, lib, queue );

