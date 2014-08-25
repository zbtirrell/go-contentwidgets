if ( 'undefined' === typeof go_content_widgets ) {
	var go_content_widgets = {
		layout_preferences: {}
	};
}//end id

(function( $ ) {
	'use strict';

	go_content_widgets.last = Date.now();
	go_content_widgets.current = Date.now();

	go_content_widgets.log = function( text ) {
		go_content_widgets.current = Date.now();
		//console.info( text, go_content_widgets.current - go_content_widgets.last );
		go_content_widgets.last = go_content_widgets.current;
	};

	go_content_widgets.init = function() {
		go_content_widgets.log( 'begin init' );
		this.shortest_widget_height = 10000;
		this.tallest_widget_height = 0;
		this.insert = [];
		this.inventory = {
			blackouts: [],
			gaps: []
		};

		this.$body = $( '#body' ).find( '.post section.body.entry-content' );
		this.$content = this.$body.find( '> div' );

		this.$first_element = this.$content.find( ':first' );
		this.$images = this.$content.find( 'img' );

		this.$images.each( function() {
			var $img = $( this );

			if ( $img.attr( 'width' ) < $img.closest( '.entry-content' ).width() ) {
				$img.css( 'height', $img.attr( 'height' ).concat( 'px' ) );
			} else {
				$img.css( 'height', 'auto' );
			}//end else
		});

		this.collect_widgets();

		this.auto_inject();
		this.$content.find( '.layout-box-thing' ).remove();
		$( '#body' ).addClass( 'rendered' );
		go_content_widgets.current = Date.now();
		console.info( 'Took this long:', go_content_widgets.current - go_content_widgets.start );
	};

	go_content_widgets.collect_widgets = function() {
		go_content_widgets.log( 'collecting widgets' );
		this.$widgets = $( '#hidden-sidebar > div' );
		this.$widgets.each( function() {
			var $widget = $( this );
			var widget_id = $widget.attr( 'id' );

			$widget.addClass( 'layout-box-insert' ); // @todo, this may not be needed long term, but for now it makes the CSS easier

			var widget = {
				name: widget_id,
				$el: $widget,
				height: parseInt( $widget.outerHeight( true ) * 0.9, 10 ),
				location: 'right',
				preferbottom: false
			};

			if ( widget.height < go_content_widgets.shortest_widget_height ) {
				go_content_widgets.shortest_widget_height = widget.height;
			}//end if

			if ( widget.height > go_content_widgets.tallest_widget_height ) {
				go_content_widgets.tallest_widget_height = widget.height;
			}//end if

			if ( 'undefined' !== typeof go_content_widgets.layout_preferences[ widget_id ] ) {
				if (
					'undefined' !== typeof go_content_widgets.layout_preferences[ widget_id ].direction
					&& 'bottom' === go_content_widgets.layout_preferences[ widget_id ].direction
				) {
					widget.preferbottom = true;
				}//end if

				if (
					'undefined' !== typeof go_content_widgets.layout_preferences[ widget_id ].location
					&& 'any' !== go_content_widgets.layout_preferences[ widget_id ].location
				) {
					widget.location = go_content_widgets.layout_preferences[ widget_id ].location;
				}//end if
			}//end if

			if ( widget.location ) {
				$widget.addClass( 'layout-box-insert-'.concat( widget.location ) );
			}//end if

			go_content_widgets.insert.push( widget );
		} );
		go_content_widgets.log( 'finished collecting widgets' );
	};

	/**
	 * auto injects items in order
	 */
	go_content_widgets.auto_inject = function() {
		for ( var i = 0, length = go_content_widgets.insert.length; i < length; i++ ) {
			go_content_widgets.calc();
			go_content_widgets.inject_item( go_content_widgets.insert[ i ] );
		}// end foreach
	};

	/**
	 * get measurement attributes for a given element
	 *
	 * @param $el jQuery element to measure
	 * @return object with measurement attributes
	 */
	go_content_widgets.attributes = function( $el ) {
		var margin_top = $el.css( 'margin-top' );

		margin_top = parseInt( margin_top.replace( 'px', '' ), 10 );

		var top = $el.get( 0 ).offsetTop;
		var height = parseInt( $el.outerHeight( true ), 10 );
		top -= margin_top;
		var end = top + height;

		var data = {
			$el: $el,
			start: top,
			end: end,
			height: height
		};

		return data;
	};

	go_content_widgets.overlay = function( $el, start, height, type ) {
		var $overlay = $( '<div class="layout-box-thing" style="top:' + start + 'px;height:' + height + 'px;"></div>' );

		if ( 'gap' === type ) {
			$el.before( $overlay );
		} else if( 'solo-gap' === type ) {
			$el.append( $overlay );
		} else {
			$el.after( $overlay );
		}// end else

		return $overlay;
	};

	go_content_widgets.reset = function() {
		this.$content.find( '.layout-box-thing' ).remove();
		this.inventory = {
			blackouts: [],
			gaps: []
		};
	};

	go_content_widgets.calc = function() {
		go_content_widgets.log( 'begin calc and reset' );
		this.reset();
		go_content_widgets.log( 'end reset/begin identify blackouts' );
		this.identify_blackouts();
		go_content_widgets.log( 'end identify blackouts/begin identify gaps' );
		this.identify_gaps();
		go_content_widgets.log( 'end identify gaps and calc' );
	};

	go_content_widgets.identify_blackouts = function() {
		go_content_widgets.log( 'before find :visible' );
		// find top level blackouts
		// since :visible isn't native CSS, following the jQuery recommendation of running it after a pure CSS selector
		this.$content.find( '> *:not(p,blockquote,h1,h2,h3,h4,h5,h6,ol,ul,script,address)' ).filter( ':visible' ).each( function() {
			var $el = $( this );
			var attr = go_content_widgets.attributes( $el );
			go_content_widgets.inventory.blackouts.push( attr );
		});

		go_content_widgets.log( 'after find :visible / before find children' );
		// find child blackouts
		this.$content.find( '> p *' ).filter( 'img,iframe,.layout-box-insert' ).each( function() {
			var $el = $( this );
			var attr = go_content_widgets.attributes( $el );
			// since this is a child, after we've calculated the blackout grab its parent p
			attr.$el = $el.closest( 'p' );
			go_content_widgets.inventory.blackouts.push( attr );
		});

		go_content_widgets.log( 'after find children / before blackout overlay generation' );

		this.inventory.blackouts.sort( this.sort_by_start );
	};

	/**
	 * sorting function used only by identify_blackouts
	 */
	go_content_widgets.sort_by_start = function( a, b ) {
		var a_start = a.start;
		var b_start = b.start;
		return ( ( a_start < b_start ) ? -1 : ( ( a_start > b_start ) ? 1 : 0 ) );
	};

	go_content_widgets.identify_gaps = function() {
		var start = 0;
		var gap;
		var i;
		var gap_height;
		var length;

		if ( 0 === this.inventory.blackouts.length ) {
			gap = {};
			gap.$overlay = this.overlay( this.$content, start, this.$content.outerHeight(), 'solo-gap' );
			gap.$first_el = this.$first_element;

			this.inventory.gaps.push( gap );
		}//end if
		else {
			var previous_blackout = null;
			for ( i = 0, length = this.inventory.blackouts.length; i < length; i++ ) {
				var blackout = this.inventory.blackouts[ i ];

				if ( blackout.start > start ) {
					gap_height = blackout.start - start;

					// if the gap height isn't tall enough for our shortest widget, don't bother with it
					if ( 0 === gap_height || gap_height < this.shortest_widget_height ) {
						start = blackout.end;
						previous_blackout = blackout;
						continue;
					}//end if

					gap = {};
					gap.$overlay = this.overlay( blackout.$el, start, gap_height, 'gap' );
					gap.$first_el = [];

					if ( 0 === start ) {
						var tmp = this.attributes( this.$first_element );

						if ( tmp.end <= blackout.start ) {
							gap.$first_el = this.$first_element;
						}//end if
					}//end if
					else {
						var tmp = this.attributes( previous_blackout.$el.next() );

						// find an element below the blackout
						while ( tmp.start < previous_blackout.end ) {
							tmp.$el = tmp.$el.next();
							if ( tmp.$el.is( '.layout-box-thing' ) ) {
								continue;
							}//end if

							tmp = this.attributes( tmp.$el );
						}// end while

						if ( tmp.start >= previous_blackout.end && tmp.end <= blackout.start ) {
							gap.$first_el = tmp.$el;
						}//end if
					}//end else

					if ( gap.$first_el.length ) {
						this.inventory.gaps.push( gap );
					}//end if
				}//end if

				start = blackout.end;
				previous_blackout = blackout;
			}//end for

			if ( previous_blackout.end < this.$content.outerHeight() ) {
				gap_height = this.$content.outerHeight() - previous_blackout.end;
				// find the last gap below the final blackout

				// if the gap height isn't tall enough for our shortest widget, don't bother doing more stuff with it
				if ( gap_height > this.shortest_widget_height ) {
					gap = {};
					gap.$overlay = this.overlay( previous_blackout.$el, start, ( this.$content.outerHeight() - start ), 'last-gap' );
					gap.$first_el = gap.$overlay.next();

					// check that the element we found is below the blackout
					// @note: slight fear that this could cause an infinite loop
					while ( gap.$first_el.length && gap.$first_el.get( 0 ).offsetTop && gap.$first_el.get( 0 ).offsetTop < previous_blackout.end ) {
						gap.$first_el = gap.$first_el.next();
					}// end while

					// make sure the gap has an element in it, if not, it can't be counted
					if ( gap.$first_el.length && gap.$first_el.get( 0 ).offsetTop ) {
						this.inventory.gaps.push( gap );
					}//end if
				}//end if
			}//end if
		}//end else
	};

	go_content_widgets.inject_item = function( item ) {
		var $element = null;
		go_content_widgets.log( 'injecting item' );

		for ( var i = 0, length = this.inventory.gaps.length; i < length; i++ ) {
			var gap = this.attributes( this.inventory.gaps[ i ].$overlay );
			gap.$overlay = this.inventory.gaps[ i ].$overlay;
			gap.$first_el = this.inventory.gaps[ i ].$first_el;
			if ( gap.height > item.height ) {
				$element = gap.$first_el;

				if ( item.preferbottom ) {
					// find the last element in the gap where item will fit
					var next_element = this.attributes( $element );
					while ( next_element.end <= gap.end && ( gap.end - next_element.start ) > item.height ) {
						//console.info( next_element.end + "<=" + gap.end + " && ( " + gap.end + " - " + next_element.start + " ) > " + item.height );
						$element = next_element.$el;
						next_element = this.attributes( $element.next() );
					}// end while
				}//end if
				else {
					break;
				}//end else
			}//end if
		}//end for

		if ( ! $element ) {
			// Failed to inject
			return false;
		}// end if

		$element.before( item.$el );
		go_content_widgets.log( 'end injecting item' );
	};

	$( function() {
		go_content_widgets.start = Date.now();
		go_content_widgets.last = go_content_widgets.start;
		go_content_widgets.init();
	});
})( jQuery );
