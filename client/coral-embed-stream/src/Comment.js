// this component will
// render its children
// render a like button
// render a permalink button
// render a reply button
// render a flag button
// translate things?

import React, {PropTypes} from 'react';
import PermalinkButton from 'coral-plugin-permalinks/PermalinkButton';

import AuthorName from 'coral-plugin-author-name/AuthorName';

import {Button} from 'coral-ui';
import TagLabel from 'coral-plugin-tag-label/TagLabel';
import Content from 'coral-plugin-commentcontent/CommentContent';
import PubDate from 'coral-plugin-pubdate/PubDate';
import {ReplyBox, ReplyButton} from 'coral-plugin-replies';
import FlagComment from 'coral-plugin-flags/FlagComment';
import LikeButton from 'coral-plugin-likes/LikeButton';
import {BestButton, IfUserCanModifyBest, BEST_TAG, commentIsBest, BestIndicator} from 'coral-plugin-best/BestButton';
import LoadMore from 'coral-embed-stream/src/LoadMore';
import {Slot} from 'coral-framework';
import IgnoredCommentTombstone from './IgnoredCommentTombstone';

import styles from './Comment.css';
import classnames from 'classnames';

const getActionSummary = (type, comment) => comment.action_summaries
  .filter((a) => a.__typename === type)[0];
const isStaff = (tags) => !tags.every((t) => t.name !== 'STAFF') ;

// hold actions links (e.g. Like, Reply) along the comment footer
const ActionButton = ({children}) => {
  return <span className="comment__action-button comment__action-button--nowrap">{ children }</span>;
};

class Comment extends React.Component {

  constructor(props) {
    super(props);
    this.state = {replyBoxVisible: false};
  }

  static propTypes = {
    reactKey: PropTypes.string.isRequired,

    // id of currently opened ReplyBox. tracked in Stream.js
    activeReplyBox: PropTypes.string.isRequired,
    disableReply: PropTypes.bool,
    setActiveReplyBox: PropTypes.func.isRequired,
    showSignInDialog: PropTypes.func.isRequired,
    postFlag: PropTypes.func.isRequired,
    postLike: PropTypes.func.isRequired,
    deleteAction: PropTypes.func.isRequired,
    parentId: PropTypes.string,
    highlighted: PropTypes.string,
    addNotification: PropTypes.func.isRequired,
    postItem: PropTypes.func.isRequired,
    depth: PropTypes.number.isRequired,
    asset: PropTypes.shape({
      id: PropTypes.string,
      title: PropTypes.string,
      url: PropTypes.string
    }).isRequired,
    currentUser: PropTypes.shape({
      id: PropTypes.string.isRequired
    }),
    comment: PropTypes.shape({
      depth: PropTypes.number,
      action_summaries: PropTypes.array.isRequired,
      body: PropTypes.string.isRequired,
      id: PropTypes.string.isRequired,
      tags: PropTypes.arrayOf(
        PropTypes.shape({
          name: PropTypes.string
        })
      ),
      replies: PropTypes.arrayOf(
        PropTypes.shape({
          body: PropTypes.string.isRequired,
          id: PropTypes.string.isRequired
        })),
      user: PropTypes.shape({
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired
      }).isRequired
    }).isRequired,

    // given a comment, return whether it should be rendered as ignored
    commentIsIgnored: React.PropTypes.func,

    // dispatch action to add a tag to a comment
    addCommentTag: React.PropTypes.func,

    // dispatch action to remove a tag from a comment
    removeCommentTag: React.PropTypes.func,

    // dispatch action to ignore another user
    ignoreUser: React.PropTypes.func,
  }

  render () {
    const {
      comment,
      parentId,
      currentUser,
      asset,
      depth,
      postItem,
      addNotification,
      showSignInDialog,
      postLike,
      highlighted,
      postFlag,
      postDontAgree,
      loadMore,
      setActiveReplyBox,
      activeReplyBox,
      deleteAction,
      addCommentTag,
      removeCommentTag,
      ignoreUser,
      disableReply,
      commentIsIgnored,
    } = this.props;

    const like = getActionSummary('LikeActionSummary', comment);
    const flag = getActionSummary('FlagActionSummary', comment);
    const dontagree = getActionSummary('DontAgreeActionSummary', comment);
    let commentClass = parentId ? `reply ${styles.Reply}` : `comment ${styles.Comment}`;
    commentClass += comment.id === 'pending' ? ` ${styles.pendingComment}` : '';

    // call a function, and if it errors, call addNotification('error', ...) (e.g. to show user a snackbar)
    const notifyOnError = (fn, errorToMessage) => async function (...args) {
      if (typeof errorToMessage !== 'function') {errorToMessage = (error) => error.message;}
      try {
        return await fn(...args);
      } catch (error) {
        addNotification('error', errorToMessage(error));
        throw error;
      }
    };

    const addBestTag = notifyOnError(() => addCommentTag({
      id: comment.id,
      tag: BEST_TAG,
    }), () => 'Failed to tag comment as best');

    const removeBestTag = notifyOnError(() => removeCommentTag({
      id: comment.id,
      tag: BEST_TAG,
    }), () => 'Failed to remove best comment tag');

    class IgnoreUserWizard extends React.Component {
      static propTypes = {

        // comment on which this menu appears
        user: PropTypes.shape({
          id: PropTypes.string.isRequired,
          name: PropTypes.string.isRequired
        }).isRequired,
        cancel: PropTypes.func.isRequired,

        // actually submit the ignore. Provide {id: user id to ignore}
        ignoreUser: PropTypes.func.isRequired,
      }
      constructor(props) {
        super(props);
        this.state = {

          // what step of the wizard is the user on
          step: 1
        };
        this.onClickCancel = this.onClickCancel.bind(this);
      }
      onClickCancel() {
        this.props.cancel();
      }
      render() {
        const {user, ignoreUser} = this.props;
        const goToStep = (stepNum) => this.setState({step: stepNum});
        const step1 = (
          <div>
            <header>Ignore User</header>
            <p>When you ignore a user, all comments they wrote on the site will be hidden from you. You can undo this later from the Profile tab.</p>
            <div className={styles.textAlignRight}>
              <Button cStyle='cancel' onClick={this.onClickCancel}>Cancel</Button>
              <Button onClick={() => goToStep(2)}>Ignore user</Button>
            </div>
          </div>
        );
        const onClickIgnoreUser = async () => {
          await ignoreUser({id: user.id});
        };
        const step2Confirmation = (
          <div>
            <header>Ignore User</header>
            <p>Are you sure you want to ignore { user.name }?</p>
            <div className={styles.textAlignRight}>
              <Button cStyle='cancel' onClick={this.onClickCancel}>Cancel</Button>
              <Button onClick={onClickIgnoreUser}>Ignore user</Button>
            </div>
          </div>
        );
        const elsForStep = [step1, step2Confirmation];
        const {step} = this.state;
        const elForThisStep = elsForStep[step - 1];
        return (
          <div className={styles.IgnoreUserWizard}>
            { elForThisStep }
          </div>
        );
      }
    }

    // TopRightMenu appears as a dropdown in the top right of the comment.
    // when you click the down cehvron, it expands and shows IgnoreUserWizard
    // when you click 'cancel' in the wizard, it closes the menu
    class TopRightMenu extends React.Component {
      static propTypes = {

        // comment on which this menu appears
        comment: PropTypes.shape({
          user: PropTypes.shape({
            id: PropTypes.string.isRequired,
            name: PropTypes.string.isRequired
          }).isRequired
        }).isRequired,
        ignoreUser: PropTypes.func,

        // show notification to the user (e.g. for errors)
        addNotification: PropTypes.func.isRequired,
      }
      constructor(props) {
        super(props);
        this.state = {
          timesReset: 0
        };
      }
      render() {
        const {comment, ignoreUser, addNotification} = this.props;

        // timesReset is used as Toggleable key so it re-renders on reset (closing the toggleable)
        const reset = () => this.setState({timesReset: this.state.timesReset + 1});
        const ignoreUserAndCloseMenuAndNotifyOnError = async ({id}) => {

          // close menu
          reset();

          // ignore user
          let errorToThrow;
          try {
            await ignoreUser({id});
          } catch (error) {
            addNotification('error', 'Failed to ignore user');
            errorToThrow = error;
          }
          throw errorToThrow;
        };
        return (
          <Toggleable key={this.state.timesReset}>
            <div style={{position: 'absolute', right: 0, zIndex: 1}}>
              <IgnoreUserWizard
                user={comment.user}
                cancel={reset}
                ignoreUser={ignoreUserAndCloseMenuAndNotifyOnError}
                />
            </div>
          </Toggleable>
        );        
      }
    }

    return (
      <div
        className={commentClass}
        id={`c_${comment.id}`}
        style={{marginLeft: depth * 30}}>
        <hr aria-hidden={true} />
        <div className={highlighted === comment.id ? 'highlighted-comment' : ''}>
          <AuthorName
            author={comment.user}/>
          { isStaff(comment.tags)
            ? <TagLabel>Staff</TagLabel>
          : null }

          { commentIsBest(comment)
            ? <TagLabel><BestIndicator /></TagLabel>
          : null }
          <PubDate created_at={comment.created_at} />
          <Slot fill="commentInfoBar" commentId={comment.id} />

          { (currentUser && (comment.user.id !== currentUser.id))
            ? <span className={styles.topRightMenu}>
                <TopRightMenu
                  comment={comment}
                  ignoreUser={ignoreUser}
                  addNotification={addNotification} />
              </span>
            : null
          }

          <Content body={comment.body} />
          <div className="commentActionsLeft comment__action-container">
            <ActionButton>
              <LikeButton
                like={like}
                id={comment.id}
                postLike={postLike}
                deleteAction={deleteAction}
                showSignInDialog={showSignInDialog}
                currentUser={currentUser} />
            </ActionButton>
            {
              !disableReply &&
              <ActionButton>
                <ReplyButton
                  onClick={() => setActiveReplyBox(comment.id)}
                  parentCommentId={parentId || comment.id}
                  currentUserId={currentUser && currentUser.id}
                  banned={false} />
              </ActionButton>
            }
            <ActionButton>
              <IfUserCanModifyBest user={currentUser}>
                <BestButton
                  isBest={commentIsBest(comment)}
                  addBest={addBestTag}
                  removeBest={removeBestTag} />
              </IfUserCanModifyBest>
            </ActionButton>
            <Slot fill="commentDetail" commentId={comment.id} />
          </div>
          <div className="commentActionsRight comment__action-container">
            <ActionButton>
              <PermalinkButton articleURL={asset.url} commentId={comment.id} />
            </ActionButton>
            <ActionButton>
              <FlagComment
                flag={flag && flag.current_user ? flag : dontagree}
                id={comment.id}
                author_id={comment.user.id}
                postFlag={postFlag}
                postDontAgree={postDontAgree}
                deleteAction={deleteAction}
                showSignInDialog={showSignInDialog}
                currentUser={currentUser} />
            </ActionButton>
          </div>
        </div>
        {
          activeReplyBox === comment.id
          ? <ReplyBox
              commentPostedHandler={() => {
                setActiveReplyBox('');
              }}
              setActiveReplyBox={setActiveReplyBox}
              parentId={parentId || comment.id}
              addNotification={addNotification}
              authorId={currentUser.id}
              postItem={postItem}
              assetId={asset.id} />
          : null
        }
        {
          comment.replies &&
          comment.replies.map(reply => {
            return commentIsIgnored(reply)
              ? <IgnoredCommentTombstone key={reply.id} />
              : <Comment
                  setActiveReplyBox={setActiveReplyBox}
                  disableReply={disableReply}
                  activeReplyBox={activeReplyBox}
                  addNotification={addNotification}
                  parentId={comment.id}
                  postItem={postItem}
                  depth={depth + 1}
                  asset={asset}
                  highlighted={highlighted}
                  currentUser={currentUser}
                  postLike={postLike}
                  postFlag={postFlag}
                  deleteAction={deleteAction}
                  addCommentTag={addCommentTag}
                  removeCommentTag={removeCommentTag}
                  ignoreUser={ignoreUser}
                  showSignInDialog={showSignInDialog}
                  reactKey={reply.id}
                  key={reply.id}
                  comment={reply} />;
          })
        }
        {
          comment.replies &&
          <div className='coral-load-more-replies'>
            <LoadMore
              assetId={asset.id}
              comments={comment.replies}
              parentId={comment.id}
              topLevel={false}
              replyCount={comment.replyCount}
              moreComments={comment.replyCount > comment.replies.length}
              loadMore={loadMore}/>
          </div>
        }
      </div>
    );
  }
}

// TODO (bengo): use arrows that match designs, probably with css borders http://stackoverflow.com/questions/15938933/creating-a-chevron-in-css
const upArrow = <span className={classnames(styles.chevron, styles.up)}></span>;
const downArrow = <span className={classnames(styles.chevron, styles.down)}></span>;
class Toggleable extends React.Component {
  constructor(props) {
    super(props);
    this.toggle = this.toggle.bind(this);
    this.close = this.close.bind(this);
    this.state = {
      isOpen: false
    };
  }
  toggle() {
    this.setState({isOpen: ! this.state.isOpen});
  }
  close() {
    this.setState({isOpen: false});
  }
  render() {
    const {children} = this.props;
    const {isOpen} = this.state;
    return (

      // /*onBlur={ this.close } */
      <span className={styles.Toggleable} tabIndex="0" >
        <span className={styles.toggler}
              onClick={this.toggle}>{isOpen ? upArrow : downArrow}</span>
        {isOpen ? children : null}
      </span>
    );
  }
}
const Menu = ({children}) => (
  <ul className={styles.Menu}>
    { children }
  </ul>
);
Menu.Item = ({children, onClick}) => (
  <li className={styles.MenuItem} onClick={onClick}>
    { children }
  </li>
);

export default Comment;
